from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from enum import Enum
from pydantic import BaseModel, Field
import json
import time
import uuid
import asyncio
from typing import List, Dict, Any, Optional, Literal

# ── LangChain / LM Studio ──────────────────────────────────────────────────────
try:
    from langchain_ollama import ChatOllama as _ChatOllama

    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False

try:
    from langchain_openai import ChatOpenAI as _ChatOpenAI

    _OPENAI_COMPAT_AVAILABLE = True
except ImportError:
    _OPENAI_COMPAT_AVAILABLE = False

from langchain_core.messages import SystemMessage, HumanMessage

# LM Studio Ollama-compatible endpoint (port 11434)
LMSTUDIO_BASE_URL = "http://127.0.0.1:11434"
LMSTUDIO_MODEL = "gpt"

# Create a full trade overview with KPIs, bar chart, and filters	KPI + bar chart + filter-select widgets
# Show me a pie chart of industry distribution and a monthly area trend	Pie + area chart
# Add a heatmap of all trade metrics across months	Full-width heatmap
# Give me a filter for imports/exports and a bar chart by region	Filter-select + bar chart
# Build a complete manufacturing risk dashboard	Switches context to manufacturing data
# Add KPI for total value, show previous vs current as line chart	KPI + multi-line chart
# Add a range filter for trade value and a pie by products	Filter-range + pie chart
# Show me just the top 3 metrics as KPI cards	3 × KPI cards
# Show all trade rows in a grid table	Full-width grid widget
# Add a grid of all transactions filtered by region	Grid widget (filtered)
# Add a text summary of the current trade data	AI-generated text/report block
# Write an executive summary of manufacturing risk trends	Text widget (narrative insight)
# Build a dashboard with a grid, a bar chart, and a text analysis section	Grid + bar + text widgets


def _get_llm():
    """Return a LangChain chat model pointed at the local LM Studio instance.
    Prefers the OpenAI-compatible endpoint (more broadly    supported by LM Studio
    Ollama mode), which is served at <base_url>/v1.
    """
    if _OPENAI_COMPAT_AVAILABLE:
        return _ChatOpenAI(
            model=LMSTUDIO_MODEL,
            base_url=f"{LMSTUDIO_BASE_URL}/v1",
            api_key="lm-studio",  # LM Studio accepts any non-empty key
            temperature=0,
        )
    if _OLLAMA_AVAILABLE:
        return _ChatOllama(
            model=LMSTUDIO_MODEL, base_url=LMSTUDIO_BASE_URL, temperature=0
        )
    raise RuntimeError(
        "No LangChain LLM backend available. Install langchain-ollama or langchain-openai."
    )


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # relaxed for local development
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sessions store for dev
SESSIONS: Dict[str, Dict[str, Any]] = {}


class Column(BaseModel):
    name: str
    type: str
    nullable: bool = True
    description: str | None = None


class TableResponse(BaseModel):
    tableName: str
    columns: List[Column]
    rows: List[Dict[str, Any]]
    meta: Dict[str, Any] | None = None


class HITLOption(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    style: Optional[dict] = None


class HITLFormField(BaseModel):
    name: str
    label: str
    type: Literal["text", "number", "boolean", "select", "textarea"]
    required: bool = False
    options: Optional[List[HITLOption]] = None
    default: Optional[Any] = None
    style: Optional[dict] = None


class HITLAction(BaseModel):
    type: Literal["binary", "options", "form"]
    title: str
    message: str
    options: Optional[List[HITLOption]] = None
    fields: Optional[List[HITLFormField]] = None
    style: Optional[dict] = None
    metadata: Optional[Any] = None


class HITLActionResult(BaseModel):
    actionId: str
    messageId: Optional[str] = None
    sessionId: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    submittedAt: Optional[float] = None


class DashboardQueryRequest(BaseModel):
    source: str
    widgetType: str
    prompt: str = ""
    filters: Optional[Dict[str, Any]] = None
    xAxisKey: Optional[str] = None


class DashboardOptionsRequest(BaseModel):
    source: str
    column: str
    filters: Optional[Dict[str, Any]] = None


class AiGenerateRequest(BaseModel):
    message: str
    sourceId: str = "global-trade"
    existingWidgets: Optional[List[Dict[str, Any]]] = None


DASHBOARD_DATA_SOURCES: Dict[str, Dict[str, Any]] = {
    "global-trade": {
        "label": "Global Trade Overview",
        "schema": {
            "imports_exports": ["All", "Imports", "Exports"],
            "industries": [
                "All",
                "Automotive",
                "Electronics",
                "Pharma",
                "Energy",
            ],
            "products": [
                "All",
                "Trade Finance",
                "Supply Chain Finance",
                "Commodity Credit",
                "Cross-border Payments",
            ],
        },
        "rows": [
            {
                "name": "Jan",
                "imports_exports": "Imports",
                "industries": "Electronics",
                "products": "Trade Finance",
                "region": "APAC",
                "country": "India",
                "value": 4100,
                "prev": 3800,
            },
            {
                "name": "Feb",
                "imports_exports": "Exports",
                "industries": "Electronics",
                "products": "Cross-border Payments",
                "region": "EMEA",
                "country": "Germany",
                "value": 4300,
                "prev": 4020,
            },
            {
                "name": "Mar",
                "imports_exports": "Imports",
                "industries": "Automotive",
                "products": "Supply Chain Finance",
                "region": "APAC",
                "country": "Japan",
                "value": 4550,
                "prev": 4200,
            },
            {
                "name": "Apr",
                "imports_exports": "Exports",
                "industries": "Pharma",
                "products": "Trade Finance",
                "region": "Americas",
                "country": "USA",
                "value": 4700,
                "prev": 4400,
            },
            {
                "name": "May",
                "imports_exports": "Imports",
                "industries": "Energy",
                "products": "Commodity Credit",
                "region": "EMEA",
                "country": "UAE",
                "value": 5200,
                "prev": 4880,
            },
            {
                "name": "Jun",
                "imports_exports": "Exports",
                "industries": "Automotive",
                "products": "Supply Chain Finance",
                "region": "Americas",
                "country": "Mexico",
                "value": 5450,
                "prev": 5100,
            },
            {
                "name": "Jul",
                "imports_exports": "Imports",
                "industries": "Pharma",
                "products": "Cross-border Payments",
                "region": "APAC",
                "country": "Singapore",
                "value": 5680,
                "prev": 5300,
            },
        ],
    },
    "manufacturing-risk": {
        "label": "Manufacturing Risk Lens",
        "schema": {
            "imports_exports": ["All", "Imports", "Exports"],
            "industries": [
                "All",
                "Metals",
                "Chemicals",
                "Industrial Goods",
                "Textiles",
            ],
            "products": [
                "All",
                "Letters of Credit",
                "Insurance",
                "Factoring",
                "Receivables",
            ],
        },
        "rows": [
            {
                "name": "Jan",
                "imports_exports": "Imports",
                "industries": "Metals",
                "products": "Letters of Credit",
                "region": "EMEA",
                "country": "Turkey",
                "value": 3600,
                "prev": 3400,
            },
            {
                "name": "Feb",
                "imports_exports": "Exports",
                "industries": "Chemicals",
                "products": "Insurance",
                "region": "APAC",
                "country": "China",
                "value": 3900,
                "prev": 3650,
            },
            {
                "name": "Mar",
                "imports_exports": "Imports",
                "industries": "Industrial Goods",
                "products": "Factoring",
                "region": "Americas",
                "country": "Brazil",
                "value": 4200,
                "prev": 3850,
            },
            {
                "name": "Apr",
                "imports_exports": "Exports",
                "industries": "Textiles",
                "products": "Receivables",
                "region": "APAC",
                "country": "Vietnam",
                "value": 4380,
                "prev": 4100,
            },
            {
                "name": "May",
                "imports_exports": "Imports",
                "industries": "Chemicals",
                "products": "Insurance",
                "region": "EMEA",
                "country": "Poland",
                "value": 4620,
                "prev": 4300,
            },
            {
                "name": "Jun",
                "imports_exports": "Exports",
                "industries": "Metals",
                "products": "Letters of Credit",
                "region": "Americas",
                "country": "Canada",
                "value": 4850,
                "prev": 4500,
            },
            {
                "name": "Jul",
                "imports_exports": "Imports",
                "industries": "Industrial Goods",
                "products": "Factoring",
                "region": "APAC",
                "country": "Thailand",
                "value": 5080,
                "prev": 4720,
            },
        ],
    },
}


def get_dashboard_source(source_id: str) -> Dict[str, Any]:
    return (
        DASHBOARD_DATA_SOURCES.get(source_id) or DASHBOARD_DATA_SOURCES["global-trade"]
    )


def infer_dashboard_schema(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    columns: List[Dict[str, Any]] = []
    if not rows:
        return {"columns": columns}

    column_names = list(rows[0].keys())
    for name in column_names:
        sample_value = None
        for row in rows:
            value = row.get(name)
            if value is not None:
                sample_value = value
                break

        value_type = "unknown"
        if isinstance(sample_value, bool):
            value_type = "boolean"
        elif isinstance(sample_value, (int, float)):
            value_type = "number"
        elif isinstance(sample_value, str):
            value_type = "string"

        unique_values = []
        if value_type in {"string", "boolean"}:
            unique_values = sorted(
                list(
                    {
                        str(row.get(name))
                        for row in rows
                        if row.get(name) is not None
                        and str(row.get(name)).strip() != ""
                    }
                )
            )

        numeric_values: List[float] = []
        if value_type == "number":
            numeric_values = [
                float(row.get(name))
                for row in rows
                if isinstance(row.get(name), (int, float))
            ]

        filterable = False
        if value_type in {"string", "boolean"}:
            filterable = len(unique_values) > 0
        elif value_type == "number":
            filterable = len(numeric_values) > 0

        column_record: Dict[str, Any] = {
            "name": name,
            "type": value_type,
            "filterable": filterable,
        }
        if filterable:
            if value_type in {"string", "boolean"}:
                column_record["options"] = ["All", *unique_values]
            if value_type == "number" and numeric_values:
                column_record["min"] = min(numeric_values)
                column_record["max"] = max(numeric_values)

        columns.append(column_record)

    return {"columns": columns}


def apply_dashboard_filters(
    rows: List[Dict[str, Any]], filters: Dict[str, Any]
) -> List[Dict[str, Any]]:
    filtered = rows
    for key, value in filters.items():
        if value in (None, "", "All"):
            continue

        if isinstance(value, list) and len(value) == 2:
            lower, upper = value
            filtered = [
                row
                for row in filtered
                if isinstance(row.get(key), (int, float))
                and float(lower) <= float(row.get(key)) <= float(upper)
            ]
            continue

        if isinstance(value, dict) and "min" in value and "max" in value:
            lower = value.get("min")
            upper = value.get("max")
            filtered = [
                row
                for row in filtered
                if isinstance(row.get(key), (int, float))
                and float(lower) <= float(row.get(key)) <= float(upper)
            ]
            continue

        filtered = [row for row in filtered if str(row.get(key)) == str(value)]

    return filtered


def get_dashboard_column_options(rows: List[Dict[str, Any]], column: str) -> List[str]:
    values = sorted(
        list(
            {
                str(row.get(column))
                for row in rows
                if row.get(column) is not None and str(row.get(column)).strip() != ""
            }
        )
    )
    return ["All", *values]


def build_dashboard_response(
    widget_type: str,
    rows: List[Dict[str, Any]],
    prompt: str,
    x_axis_key: Optional[str] = None,
) -> Any:
    prompt_lower = (prompt or "").lower()
    if widget_type == "filter-range":
        if not rows:
            return [0, 100]
        values = [int(row.get("value", 0)) for row in rows]
        return [min(values), max(values)]

    if widget_type == "text":
        # Text widgets carry no data row; content is stored in the prompt field.
        return []

    if widget_type == "grid":
        # Return all columns from each row as-is; frontend renders a full table.
        return [dict(row) for row in rows]

    if widget_type == "pie":
        grouped: Dict[str, int] = {}
        # Use caller-supplied key first, then auto-detect from first string column
        group_column = x_axis_key or "industries"
        if not x_axis_key:
            if rows:
                sample = rows[0]
                string_columns = [
                    key
                    for key, value in sample.items()
                    if isinstance(value, str) and key not in {"name"}
                ]
                if string_columns:
                    group_column = string_columns[0]

        for row in rows:
            group_value = str(row.get(group_column) or "Unknown")
            grouped[group_value] = grouped.get(group_value, 0) + int(
                row.get("value", 0)
            )
        return [
            {
                "name": key,
                "value": val,
                "_filterKey": group_column,
                "_filterValue": key,
            }
            for key, val in grouped.items()
        ]

    if widget_type == "kpi":
        total_current = sum(int(row.get("value", 0)) for row in rows)
        total_prev = sum(int(row.get("prev", 0)) for row in rows)
        if total_prev <= 0:
            change_pct = 0.0
        else:
            change_pct = ((total_current - total_prev) / total_prev) * 100
        sign = "+" if change_pct >= 0 else ""
        if "risk" in prompt_lower:
            normalized = min(100, max(0, int(total_current / 120)))
            return [
                {
                    "value": f"{normalized}/100",
                    "change": f"{sign}{change_pct:.1f}%",
                    "positive": change_pct >= 0,
                }
            ]
        return [
            {
                "value": f"${total_current:,.0f}M",
                "change": f"{sign}{change_pct:.1f}%",
                "positive": change_pct >= 0,
            }
        ]

    # For bar / area / line: if the caller supplied a categorical xAxisKey
    # (not a time-series field), aggregate the rows so each category appears once.
    if (
        widget_type in ("bar", "area", "line")
        and x_axis_key
        and x_axis_key not in _TIME_KEYS
    ):
        return _aggregate_by_key(rows, x_axis_key)

    return [dict(row) for row in rows]


# Time-series keys that should NOT trigger categorical aggregation
_TIME_KEYS = {"name", "date", "month", "year", "quarter", "week", "period", "time"}


def _aggregate_by_key(
    rows: List[Dict[str, Any]], group_key: str
) -> List[Dict[str, Any]]:
    """Sum numeric columns grouped by group_key, preserving order of first appearance."""
    seen: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        gval = str(row.get(group_key) or "Unknown")
        if gval not in seen:
            seen[gval] = {group_key: gval, "value": 0, "prev": 0}
        seen[gval]["value"] += int(row.get("value", 0))
        seen[gval]["prev"] += int(row.get("prev", 0))
    return list(seen.values())


@app.get("/dashboard/data-sources")
async def list_dashboard_data_sources():
    return {
        "sources": [
            {"id": source_id, "label": source["label"]}
            for source_id, source in DASHBOARD_DATA_SOURCES.items()
        ]
    }


@app.get("/dashboard/schema")
async def get_dashboard_schema(source: Optional[str] = None):
    selected_source = source or "global-trade"
    source_record = get_dashboard_source(selected_source)
    return {
        "source": selected_source,
        "schema": infer_dashboard_schema(source_record["rows"]),
    }


@app.post("/dashboard/query")
async def query_dashboard_data(payload: DashboardQueryRequest):
    source_record = get_dashboard_source(payload.source)
    rows = apply_dashboard_filters(source_record["rows"], payload.filters or {})
    result = build_dashboard_response(
        payload.widgetType, rows, payload.prompt, payload.xAxisKey
    )
    return {
        "source": payload.source,
        "widgetType": payload.widgetType,
        "data": result,
    }


@app.post("/dashboard/options")
async def get_dashboard_options(payload: DashboardOptionsRequest):
    source_record = get_dashboard_source(payload.source)
    incoming_filters = payload.filters or {}
    scoped_filters = {
        key: value for key, value in incoming_filters.items() if key != payload.column
    }
    rows = apply_dashboard_filters(source_record["rows"], scoped_filters)
    options = get_dashboard_column_options(rows, payload.column)
    return {
        "source": payload.source,
        "column": payload.column,
        "options": options,
    }


#  AI Dashboard Generation  Pydantic output schema


class _WidgetType(str, Enum):
    bar = "bar"
    area = "area"
    line = "line"
    pie = "pie"
    heatmap = "heatmap"
    kpi = "kpi"
    grid = "grid"
    text = "text"
    filter_select = "filter-select"
    filter_range = "filter-range"


class _XAxisKey(str, Enum):
    name = "name"
    imports_exports = "imports_exports"
    industries = "industries"
    products = "products"
    region = "region"
    country = "country"


class _WidgetAction(BaseModel):
    """A single widget to add to the dashboard."""

    widgetType: _WidgetType = Field(description="The chart or widget type to render.")
    title: str = Field(
        description="Short, descriptive title for the widget (3-5 words)."
    )
    prompt: str = Field(
        description=(
            "What data to show. "
            "For filter-select/filter-range use the column name as the prompt."
        )
    )
    span: Literal[1, 2, 3] = Field(
        description=(
            "Width: 1=small (kpi/pie/filter), "
            "2=half-width (bar/area/line/grid default), "
            "3=full-width (heatmap/text)."
        )
    )
    xAxisKey: _XAxisKey = Field(
        description=(
            "Column to group or trend by. "
            "name=monthly time-series, industries=by industry, "
            "products=by product, region=by region, "
            "country=by country, imports_exports=by trade direction."
        )
    )


class _DashboardAiResponse(BaseModel):
    """Structured response from the dashboard AI assistant."""

    message: str = Field(
        description="Friendly 1-2 sentence explanation of what is being added."
    )
    actions: List[_WidgetAction] = Field(
        description="List of widgets to add (1-6 actions)."
    )


_AI_SYSTEM_PROMPT = """You are a dashboard widget generator for CitiForge (financial trade analytics).

OUTPUT RULE: Respond with ONLY a single valid JSON object. No markdown fences, no prose before or after, no reasoning text, no comments.

JSON SCHEMA (follow exactly):
{{
  "message": "<1-2 sentence summary of what is being added>",
  "actions": [
    {{
      "widgetType": "<bar|area|line|pie|heatmap|kpi|grid|text|filter-select|filter-range>",
      "title": "<3-5 word title>",
      "prompt": "<what data to show; for filter-select/filter-range use the column name>",
      "span": <1|2|3>,
      "xAxisKey": "<name|imports_exports|industries|products|region|country>"
    }}
  ]
}}

SPAN RULES (mandatory):
  kpi=1  pie=1  filter-select=1  filter-range=1
  bar=2  area=2  line=2  grid=2
  heatmap=3  text=3

XAXISKEY RULES:
  monthly / time-series trend  →  name
  group by industry             →  industries
  group by product              →  products
  group by region               →  region
  group by country              →  country
  imports vs exports            →  imports_exports
  text or grid (all rows)       →  name

DATA SOURCE: {source_id}
COLUMNS: name (Jan-Jul months), imports_exports (Imports|Exports),
  industries ({industries}), products ({products}),
  region (APAC|EMEA|Americas), country, value (trade value), prev (prior period)

EXISTING WIDGETS: {existing_widgets}

EXAMPLE — user asks "KPI and bar chart by industry":
{{"message":"Adding a total value KPI and a bar chart by industry.","actions":[{{"widgetType":"kpi","title":"Total Trade Value","prompt":"Headline total trade value","span":1,"xAxisKey":"name"}},{{"widgetType":"bar","title":"Trade by Industry","prompt":"Compare trade value by industry","span":2,"xAxisKey":"industries"}}]}}

EXAMPLE — user asks "full overview with KPIs, bar chart, and filters":
{{"message":"Building a full trade overview with KPI cards, a bar chart, and filter controls.","actions":[{{"widgetType":"kpi","title":"Total Trade Value","prompt":"Headline total trade value","span":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"YoY Change","prompt":"Period-over-period trade change","span":1,"xAxisKey":"name"}},{{"widgetType":"bar","title":"Trade by Industry","prompt":"Compare trade value across industries","span":2,"xAxisKey":"industries"}},{{"widgetType":"filter-select","title":"Filter: Type","prompt":"imports_exports","span":1,"xAxisKey":"imports_exports"}},{{"widgetType":"filter-select","title":"Filter: Industry","prompt":"industries","span":1,"xAxisKey":"industries"}}]}}

USER REQUEST: {user_message}

JSON output:
"""


# ── helpers for rule-based fallback ──────────────────────────────────────────


def _w(widget_type: str, title: str, prompt: str, span: int, x: str) -> dict:
    return {
        "type": "add_widget",
        "widgetType": widget_type,
        "title": title,
        "prompt": prompt,
        "span": span,
        "xAxisKey": x,
    }


def _rule_based_widgets(message: str) -> list:
    """Keyword-based widget builder used when LLM returns no actions."""
    m = message.lower()
    widgets: list = []

    if any(k in m for k in ("full", "overview", "complete")):
        return [
            _w("kpi", "Total Trade Value", "Headline total trade value", 1, "name"),
            _w("kpi", "YoY Change", "Period-over-period trade change", 1, "name"),
            _w(
                "bar",
                "Trade by Industry",
                "Compare trade value by industry",
                2,
                "industries",
            ),
            _w(
                "filter-select", "Filter: Type", "imports_exports", 1, "imports_exports"
            ),
            _w("filter-select", "Filter: Industry", "industries", 1, "industries"),
        ]
    if "manufacturing" in m and "risk" in m:
        return [
            _w("kpi", "Risk Score", "Manufacturing risk score", 1, "name"),
            _w("kpi", "Total Value", "Headline trade value", 1, "name"),
            _w(
                "heatmap",
                "Risk Heatmap",
                "Color intensity across months and metrics",
                3,
                "name",
            ),
            _w("bar", "Value by Country", "Compare value by country", 2, "country"),
            _w("filter-select", "Filter: Industry", "industries", 1, "industries"),
        ]

    x_key = (
        "country"
        if "country" in m
        else (
            "region"
            if "region" in m
            else (
                "imports_exports"
                if any(k in m for k in ("import", "export"))
                else (
                    "industries"
                    if "industr" in m
                    else "products" if "product" in m else "name"
                )
            )
        )
    )

    if "kpi" in m or "metric" in m or "card" in m:
        count = 3 if ("top 3" in m or "three" in m) else 1
        for i in range(count):
            widgets.append(
                _w(
                    "kpi",
                    f"KPI {i+1}" if count > 1 else "Key Metric",
                    "Headline trade value",
                    1,
                    "name",
                )
            )
    if any(k in m for k in ("bar chart", "bar", "column")):
        widgets.append(
            _w(
                "bar",
                "Bar Chart",
                f"Compare trade value by {x_key.replace('_',' ')}",
                2,
                x_key,
            )
        )
    if any(k in m for k in ("area", "trend")):
        widgets.append(_w("area", "Trend Chart", "Monthly trend over time", 2, "name"))
    if any(k in m for k in ("line chart", "line", "previous vs", "prev vs")):
        widgets.append(
            _w("line", "Line Chart", "Multi-series trend comparison", 2, "name")
        )
    if "pie" in m:
        pie_x = (
            "industries"
            if "industr" in m
            else "products" if "product" in m else "imports_exports"
        )
        widgets.append(_w("pie", "Distribution", f"Distribution by {pie_x}", 1, pie_x))
    if "heatmap" in m:
        widgets.append(
            _w(
                "heatmap",
                "Heatmap",
                "Color intensity across months and metrics",
                3,
                "name",
            )
        )
    if "grid" in m or "table" in m or "rows" in m:
        widgets.append(
            _w("grid", "Data Grid", "All trade rows in tabular view", 2, "name")
        )
    if any(k in m for k in ("text", "summary", "report", "executive")):
        widgets.append(
            _w(
                "text",
                "Report Summary",
                "Executive summary of current trade data",
                3,
                "name",
            )
        )
    if "filter" in m and "range" not in m:
        widgets.append(
            _w("filter-select", "Filter: Industry", "industries", 1, "industries")
        )
    if "range filter" in m or "range" in m:
        widgets.append(_w("filter-range", "Trade Value Range", "value", 1, "name"))

    if not widgets:
        widgets = [
            _w("kpi", "Total Trade Value", "Headline total trade value", 1, "name"),
            _w(
                "bar",
                "Trade by Industry",
                "Compare trade value by industry",
                2,
                "industries",
            ),
            _w(
                "filter-select", "Filter: Type", "imports_exports", 1, "imports_exports"
            ),
        ]
    return widgets


def _extract_json(text: str) -> dict | None:
    """Pull a JSON object out of a possibly noisy LLM response string."""
    import re

    text = re.sub(r"```[a-zA-Z]*\n?", "", text).strip()
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except Exception:
        return None


@app.post("/dashboard/ai-generate")
async def ai_generate_dashboard(payload: AiGenerateRequest):
    """Generate dashboard widget actions via LLM with rule-based fallback."""
    source_record = get_dashboard_source(payload.sourceId)
    schema = source_record.get("schema", {})

    existing = payload.existingWidgets or []
    existing_summary = (
        ", ".join(f"{w.get('type','?')} '{w.get('title','?')}'" for w in existing)
        if existing
        else "none"
    )

    prompt_text = _AI_SYSTEM_PROMPT.format(
        source_id=payload.sourceId,
        industries=", ".join(v for v in schema.get("industries", []) if v != "All"),
        products=", ".join(v for v in schema.get("products", []) if v != "All"),
        existing_widgets=existing_summary,
        user_message=payload.message,
    )

    actions: list = []
    response_message = ""
    used_fallback = False

    # ── Tier 1: structured output ──────────────────────────────────────────────
    try:
        structured_llm = _get_llm().with_structured_output(_DashboardAiResponse)
        result: _DashboardAiResponse = await structured_llm.ainvoke(
            [HumanMessage(content=prompt_text)]
        )
        if result.actions:
            actions = [
                {
                    "type": "add_widget",
                    "widgetType": a.widgetType.value,
                    "title": a.title,
                    "prompt": a.prompt,
                    "span": a.span,
                    "xAxisKey": a.xAxisKey.value,
                }
                for a in result.actions
            ]
            response_message = result.message
    except Exception:
        pass

    # ── Tier 2: raw JSON parse from plain LLM call ────────────────────────────
    if not actions:
        try:
            llm = _get_llm()
            raw = await llm.ainvoke([HumanMessage(content=prompt_text)])
            raw_text = raw.content if hasattr(raw, "content") else str(raw)
            parsed = _extract_json(raw_text)
            if parsed and isinstance(parsed.get("actions"), list) and parsed["actions"]:
                valid_types = {t.value for t in _WidgetType}
                valid_keys = {k.value for k in _XAxisKey}
                for a in parsed["actions"]:
                    if (
                        a.get("widgetType") in valid_types
                        and a.get("xAxisKey") in valid_keys
                    ):
                        actions.append(
                            {
                                "type": "add_widget",
                                "widgetType": a["widgetType"],
                                "title": str(a.get("title", a["widgetType"])),
                                "prompt": str(a.get("prompt", "")),
                                "span": int(a.get("span", 2)),
                                "xAxisKey": a["xAxisKey"],
                            }
                        )
                response_message = str(parsed.get("message", ""))
        except Exception:
            pass

    # ── Tier 3: rule-based fallback ───────────────────────────────────────────
    if not actions:
        actions = _rule_based_widgets(payload.message)
        response_message = f'Built your dashboard from: "{payload.message}"'
        used_fallback = True

    return {
        "ok": True,
        "message": response_message or f"Added {len(actions)} widget(s).",
        "actions": actions,
        "fallback": used_fallback,
    }


# ── Text / Report block generation ────────────────────────────────────────────


class TextGenerateRequest(BaseModel):
    source: str = "global-trade"
    title: str = ""
    prompt: str = ""
    filters: Optional[Dict[str, Any]] = None


_TEXT_SYSTEM_PROMPT = """You are a financial analyst writing a concise dashboard report section for CitiForge.

Data source: {source_id}
Section title: {title}
User instruction: {prompt}

Summary statistics from the current dataset (after filters applied):
  Total rows: {total_rows}
  Value range: {min_val:,} – {max_val:,}
  Industries in view: {industries}
  Regions in view: {regions}

Write 2–4 sentences of plain-language analysis suitable for an executive dashboard.
Be specific about the numbers where possible. Do not use markdown headings or bullet points.
"""


@app.post("/dashboard/text-generate")
async def generate_text_content(payload: TextGenerateRequest):
    """Generate an AI-written report paragraph for a Text widget."""
    source_record = get_dashboard_source(payload.source)
    rows = apply_dashboard_filters(source_record["rows"], payload.filters or {})

    values = [
        int(r.get("value", 0)) for r in rows if isinstance(r.get("value"), (int, float))
    ]
    min_val = min(values) if values else 0
    max_val = max(values) if values else 0
    industries = sorted(
        {str(r.get("industries", "")) for r in rows if r.get("industries")}
    )
    regions = sorted({str(r.get("region", "")) for r in rows if r.get("region")})

    system_content = _TEXT_SYSTEM_PROMPT.format(
        source_id=payload.source,
        title=payload.title or "Report Section",
        prompt=payload.prompt or "Summarise the current data view.",
        total_rows=len(rows),
        min_val=min_val,
        max_val=max_val,
        industries=", ".join(industries) if industries else "all",
        regions=", ".join(regions) if regions else "all",
    )

    try:
        llm = _get_llm()
        result = await llm.ainvoke([SystemMessage(content=system_content)])
        text_content = result.content if hasattr(result, "content") else str(result)
        return {"ok": True, "text": text_content.strip()}
    except Exception as exc:
        # Fallback: return a simple stats-based summary without LLM
        fallback = (
            f"This section covers {len(rows)} data point(s) for {payload.source.replace('-', ' ').title()}. "
            f"Trade values range from {min_val:,} to {max_val:,}. "
            f"Industries represented: {', '.join(industries) if industries else 'N/A'}. "
            f"Regions in view: {', '.join(regions) if regions else 'N/A'}."
        )
        return {"ok": True, "text": fallback, "fallback": True, "error": str(exc)}


def build_suggested_queries(input_text: str) -> List[Dict[str, Any]]:
    text = (input_text or "").lower()
    if "migration" in text or "sql" in text:
        return [
            {
                "id": "sq_generate_sql",
                "title": "⚡ Generate Migration",
                "description": "Create SQL migration from the latest schema.",
                "prompt": "Generate SQL migration script for this schema.",
                "variant": "primary",
            },
            {
                "id": "sq_edit_schema",
                "title": "🛠 Edit Schema",
                "description": "Adjust fields and naming before apply.",
                "prompt": "Edit the schema with my latest changes.",
            },
            {
                "id": "sq_validate_model",
                "title": "🧪 Validate Model",
                "description": "Run consistency and type checks.",
                "prompt": "Validate this model and list any risks or inconsistencies.",
            },
        ]

    return [
        {
            "id": "sq_generate_sql",
            "title": "⚡ Generate Migration",
            "description": "Create migration SQL from your latest schema.",
            "prompt": "Generate SQL migration script for this schema.",
            "variant": "primary",
        },
        {
            "id": "sq_edit_schema",
            "title": "🛠 Edit Schema",
            "description": "Adjust fields, enums, and naming quickly.",
            "prompt": "Edit the schema with my latest changes.",
        },
        {
            "id": "sq_seed_data",
            "title": "🌱 Create Seed Data",
            "description": "Generate realistic sample records for testing.",
            "prompt": "Create representative seed data for this schema.",
        },
    ]


@app.get("/sessions")
async def list_sessions():
    return list(SESSIONS.values())


@app.post("/sessions")
async def create_session(payload: Dict[str, Any]):
    sid = str(uuid.uuid4())
    session = {
        "id": sid,
        "agent": payload.get("agent"),
        "title": payload.get("title") or f"Session {sid[:8]}",
        "createdAt": time.time(),
        "lastUpdated": time.time(),
    }
    SESSIONS[sid] = session
    return session


@app.put("/sessions/{session_id}")
async def touch_session(session_id: str):
    if session_id in SESSIONS:
        SESSIONS[session_id]["lastUpdated"] = time.time()
        return JSONResponse({"ok": True})
    return JSONResponse({"ok": False}, status_code=404)


@app.post("/createDataModel")
async def create_data_model(payload: Dict[str, Any]):
    # A placeholder endpoint that would kick off a LangGraph/LLM pipeline in production.
    # For now, return a job id and echo the payload.
    job_id = str(uuid.uuid4())
    return {"jobId": job_id, "received": payload}


@app.options("/sessions")
async def options_sessions():
    return JSONResponse(status_code=200, content={})


@app.options("/sessions/{session_id}")
async def options_session(session_id: str):
    return JSONResponse(status_code=200, content={})


@app.delete("/sessions")
async def clear_sessions():
    SESSIONS.clear()
    return JSONResponse({"ok": True})


@app.options("/sessions")
async def options_clear_sessions():
    return JSONResponse(status_code=200, content={})


# POST stream for chat + table streaming. Streams NDJSON chunks with {type, content}.
@app.post("/stream")
async def stream(request: Request):
    content_type = request.headers.get("content-type", "")
    input_text = ""
    message_id = ""
    hitl_action_result: Optional[HITLActionResult] = None

    if "application/json" in content_type:
        payload = await request.json()
        input_text = payload.get("message", payload.get("input", ""))
        message_id = payload.get("id", "")
        raw_hitl_action_result = payload.get("hitlActionResult")
        if raw_hitl_action_result:
            if hasattr(HITLActionResult, "model_validate"):
                hitl_action_result = HITLActionResult.model_validate(
                    raw_hitl_action_result
                )
            else:
                hitl_action_result = HITLActionResult.parse_obj(raw_hitl_action_result)
    elif "multipart/form-data" in content_type:
        form = await request.form()
        input_text = form.get("message", "") or form.get("input", "") or ""
        message_id = form.get("id", "") or ""
        # Files can be attached in multipart uploads; consume to avoid warnings.
        _ = form.getlist("files") if hasattr(form, "getlist") else []
    else:
        input_text = request.query_params.get("message", "")
        if not input_text:
            input_text = request.query_params.get("input", "")
        message_id = request.query_params.get("id", "")

    if hitl_action_result is not None:
        result_payload = (
            hitl_action_result.model_dump()
            if hasattr(hitl_action_result, "model_dump")
            else hitl_action_result.dict()
        )
        action_id = str(result_payload.get("actionId") or "")
        suggested_queries = [
            {
                "id": "sq_generate_sql",
                "title": "⚡ Generate Migration",
                "description": "Create migration SQL from the latest schema.",
                "prompt": "Generate SQL migration script for this schema.",
                "variant": "primary",
            },
            {
                "id": "sq_edit_schema",
                "title": "🛠 Edit Schema",
                "description": "Adjust fields, enums, and naming before finalizing.",
                "prompt": "Edit the schema with my latest changes.",
            },
            {
                "id": "sq_refine_constraints",
                "title": "✅ Tighten Rules",
                "description": "Add nullable, compliance, and naming constraints.",
                "prompt": "Refine this schema with stricter constraints and validation rules.",
            },
            {
                "id": "sq_add_indexes",
                "title": "📈 Suggest Indexes",
                "description": "Recommend indexes for read/write performance.",
                "prompt": "Suggest indexes and explain expected performance impact.",
            },
        ]
        if action_id == "submit_form":
            suggested_queries = [
                {
                    "id": "sq_generate_sql",
                    "title": "⚡ Generate Migration",
                    "description": "Create migration SQL for approved schema values.",
                    "prompt": "Generate SQL migration script using the approved form values.",
                    "variant": "primary",
                },
                {
                    "id": "sq_edit_schema",
                    "title": "🛠 Edit Schema",
                    "description": "Update the model before moving ahead.",
                    "prompt": "Edit the approved schema with additional changes.",
                },
                {
                    "id": "sq_validate_model",
                    "title": "🧪 Validate Model",
                    "description": "Run consistency and type validation checks.",
                    "prompt": "Validate this model and list any risks or inconsistencies.",
                },
                {
                    "id": "sq_seed_data",
                    "title": "🌱 Create Seed Data",
                    "description": "Produce realistic sample records for testing.",
                    "prompt": "Create representative seed data for this approved schema.",
                },
            ]
        elif action_id in {"modify", "edit_schema"}:
            suggested_queries = [
                {
                    "id": "sq_generate_sql",
                    "title": "⚡ Generate Migration",
                    "description": "Build migration SQL once edits are complete.",
                    "prompt": "Generate SQL migration for the updated schema.",
                    "variant": "primary",
                },
                {
                    "id": "sq_edit_schema",
                    "title": "🛠 Edit Schema",
                    "description": "Continue refining fields and enums.",
                    "prompt": "Edit core fields, data types, and enums based on feedback.",
                },
                {
                    "id": "sq_compare_versions",
                    "title": "🔎 Compare Versions",
                    "description": "Highlight changes from prior proposal.",
                    "prompt": "Compare the current schema with the previous version and summarize differences.",
                },
                {
                    "id": "sq_collect_requirements",
                    "title": "🧩 Capture Gaps",
                    "description": "List open questions before final approval.",
                    "prompt": "List the missing requirements I should confirm before approval.",
                },
            ]

        print(
            "[MOCK HITL] Received action result via /stream:",
            json.dumps(result_payload),
        )

        async def hitl_result_stream():
            yield json.dumps(
                {
                    "render_type": "done",
                    "message": "HITL action result received.",
                    "meta": {
                        "hitlActionResult": result_payload,
                        "suggestedQueries": suggested_queries,
                    },
                }
            ) + "\n"

        return StreamingResponse(
            hitl_result_stream(), media_type="application/x-ndjson"
        )

    # Simulate an LLM producing a plan, then returning table data at completion.
    async def event_stream():
        # Send step metadata first to indicate total steps
        yield json.dumps({"render_type": "start", "total_steps": 3}) + "\n"

        # Step 1: Plan overview - yield step chunk to indicate execution starting
        yield json.dumps(
            {"render_type": "step", "message": "Plan overview", "step": 1}
        ) + "\n"

        chunks = [
            "I will propose a table schema for your products. ",
            "First I will list columns and types. ",
            "Then I will return the full table payload for rendering.",
        ]
        for c in chunks:
            if await await_disconnect(request):
                return
            yield json.dumps(
                {
                    "render_type": "text",
                    "message": c,
                    "step": 1,
                    "step_name": "Plan overview",
                }
            ) + "\n"
            await asyncio.sleep(2)

        # Step 2: Prepare table payload - yield step chunk to indicate execution starting
        yield json.dumps(
            {"render_type": "step", "message": "Prepare table payload", "step": 2}
        ) + "\n"

        table_rows = [
            {
                "id": "p1",
                "name": "Product A",
                "price": 9.99,
                "currency": "USD",
                "available_since": "2024-01-10T00:00:00Z",
            },
            {
                "id": "p2",
                "name": "Product B",
                "price": 19.99,
                "currency": "USD",
                "available_since": "2024-02-15T00:00:00Z",
            },
        ]
        # Step 3: Finalize - yield step chunk to indicate execution starting
        yield json.dumps(
            {"render_type": "step", "message": "Finalize", "step": 3}
        ) + "\n"

        hitl = HITLAction(
            type="binary",
            title="Review and approve data model plan",
            message="Provide the final details, then submit the approval.",
            options=[
                HITLOption(
                    id="approve_plan",
                    label="Approve",
                    description="Approve and continue.",
                    style={"variant": "primary"},
                ),
                HITLOption(
                    id="edit_schema",
                    label="Edit Schema",
                    description="Make changes before approval.",
                    style={"variant": "secondary"},
                ),
            ],
            style={"variant": "card"},
            metadata={
                "hint": "Choose Approve to continue, or Edit Schema to revise first."
            },
        )

        hitl_payload = hitl.model_dump() if hasattr(hitl, "model_dump") else hitl.dict()

        yield json.dumps(
            {
                "type": "done",
                "content": "",
                "meta": {
                    "hitl": hitl_payload,
                    "tableDataString": json.dumps(table_rows),
                    "suggestedQueries": build_suggested_queries(input_text),
                },
                "render_type": "done",
                "message": "",
            }
        ) + "\n"

    # Fast helper to check client disconnect in generator context
    async def await_disconnect(req: Request):
        try:
            return await req.is_disconnected()
        except Exception:
            return True

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
