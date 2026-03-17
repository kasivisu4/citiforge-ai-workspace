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
                "margin_pct": 12.4,
                "deal_count": 38,
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
                "margin_pct": 13.1,
                "deal_count": 41,
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
                "margin_pct": 11.8,
                "deal_count": 45,
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
                "margin_pct": 14.2,
                "deal_count": 52,
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
                "margin_pct": 10.5,
                "deal_count": 47,
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
                "margin_pct": 12.9,
                "deal_count": 60,
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
                "margin_pct": 15.0,
                "deal_count": 64,
            },
            {
                "name": "Aug",
                "imports_exports": "Exports",
                "industries": "Electronics",
                "products": "Trade Finance",
                "region": "APAC",
                "country": "South Korea",
                "value": 5820,
                "prev": 5500,
                "margin_pct": 13.7,
                "deal_count": 58,
            },
            {
                "name": "Sep",
                "imports_exports": "Imports",
                "industries": "Energy",
                "products": "Commodity Credit",
                "region": "EMEA",
                "country": "Saudi Arabia",
                "value": 6050,
                "prev": 5700,
                "margin_pct": 9.8,
                "deal_count": 55,
            },
            {
                "name": "Oct",
                "imports_exports": "Exports",
                "industries": "Pharma",
                "products": "Trade Finance",
                "region": "Americas",
                "country": "Brazil",
                "value": 6300,
                "prev": 5900,
                "margin_pct": 14.5,
                "deal_count": 70,
            },
            {
                "name": "Nov",
                "imports_exports": "Imports",
                "industries": "Automotive",
                "products": "Supply Chain Finance",
                "region": "APAC",
                "country": "China",
                "value": 6100,
                "prev": 5800,
                "margin_pct": 12.2,
                "deal_count": 66,
            },
            {
                "name": "Dec",
                "imports_exports": "Exports",
                "industries": "Electronics",
                "products": "Cross-border Payments",
                "region": "EMEA",
                "country": "UK",
                "value": 6450,
                "prev": 6100,
                "margin_pct": 13.8,
                "deal_count": 75,
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
                "risk_score": 62,
                "exposure_pct": 18.5,
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
                "risk_score": 55,
                "exposure_pct": 21.0,
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
                "risk_score": 48,
                "exposure_pct": 16.3,
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
                "risk_score": 51,
                "exposure_pct": 14.8,
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
                "risk_score": 44,
                "exposure_pct": 20.1,
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
                "risk_score": 39,
                "exposure_pct": 17.6,
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
                "risk_score": 43,
                "exposure_pct": 15.9,
            },
            {
                "name": "Aug",
                "imports_exports": "Exports",
                "industries": "Textiles",
                "products": "Receivables",
                "region": "EMEA",
                "country": "Bangladesh",
                "value": 5250,
                "prev": 4980,
                "risk_score": 57,
                "exposure_pct": 22.4,
            },
            {
                "name": "Sep",
                "imports_exports": "Imports",
                "industries": "Metals",
                "products": "Letters of Credit",
                "region": "Americas",
                "country": "Argentina",
                "value": 5100,
                "prev": 4850,
                "risk_score": 68,
                "exposure_pct": 19.2,
            },
            {
                "name": "Oct",
                "imports_exports": "Exports",
                "industries": "Chemicals",
                "products": "Insurance",
                "region": "APAC",
                "country": "India",
                "value": 5380,
                "prev": 5050,
                "risk_score": 46,
                "exposure_pct": 18.0,
            },
            {
                "name": "Nov",
                "imports_exports": "Imports",
                "industries": "Industrial Goods",
                "products": "Factoring",
                "region": "EMEA",
                "country": "Czech Rep.",
                "value": 5620,
                "prev": 5300,
                "risk_score": 41,
                "exposure_pct": 16.7,
            },
            {
                "name": "Dec",
                "imports_exports": "Exports",
                "industries": "Textiles",
                "products": "Receivables",
                "region": "Americas",
                "country": "Peru",
                "value": 5800,
                "prev": 5480,
                "risk_score": 38,
                "exposure_pct": 13.5,
            },
        ],
    },
    "citi-financial-summary": {
        "label": "Citi Financial Summary (2020–2024)",
        "schema": {
            "period": ["All", "2024", "2023", "2022", "2021", "2020"],
            "category": [
                "All",
                "Balance Sheet",
                "Performance Metrics",
                "Basel III Ratios",
                "Capital",
            ],
            "segment": [
                "All",
                "Citigroup",
                "Common Stockholders",
                "Total Stockholders",
            ],
        },
        "rows": [
            # ── Balance Sheet ──────────────────────────────────────────────────
            {
                "name": "Total Assets",
                "period": "2024",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 2352945,
                "prev": 2411834,
                "unit": "$M",
                "metric": "Total Assets",
            },
            {
                "name": "Total Assets",
                "period": "2023",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 2411834,
                "prev": 2416676,
                "unit": "$M",
                "metric": "Total Assets",
            },
            {
                "name": "Total Assets",
                "period": "2022",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 2416676,
                "prev": 2291413,
                "unit": "$M",
                "metric": "Total Assets",
            },
            {
                "name": "Total Assets",
                "period": "2021",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 2291413,
                "prev": 2260090,
                "unit": "$M",
                "metric": "Total Assets",
            },
            {
                "name": "Total Assets",
                "period": "2020",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 2260090,
                "prev": 1951158,
                "unit": "$M",
                "metric": "Total Assets",
            },
            {
                "name": "Total Deposits",
                "period": "2024",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 1284458,
                "prev": 1308681,
                "unit": "$M",
                "metric": "Total Deposits",
            },
            {
                "name": "Total Deposits",
                "period": "2023",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 1308681,
                "prev": 1365954,
                "unit": "$M",
                "metric": "Total Deposits",
            },
            {
                "name": "Total Deposits",
                "period": "2022",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 1365954,
                "prev": 1317230,
                "unit": "$M",
                "metric": "Total Deposits",
            },
            {
                "name": "Total Deposits",
                "period": "2021",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 1317230,
                "prev": 1280671,
                "unit": "$M",
                "metric": "Total Deposits",
            },
            {
                "name": "Total Deposits",
                "period": "2020",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 1280671,
                "prev": 1070590,
                "unit": "$M",
                "metric": "Total Deposits",
            },
            {
                "name": "Long-term Debt",
                "period": "2024",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 287300,
                "prev": 286619,
                "unit": "$M",
                "metric": "Long-term Debt",
            },
            {
                "name": "Long-term Debt",
                "period": "2023",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 286619,
                "prev": 271606,
                "unit": "$M",
                "metric": "Long-term Debt",
            },
            {
                "name": "Long-term Debt",
                "period": "2022",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 271606,
                "prev": 254374,
                "unit": "$M",
                "metric": "Long-term Debt",
            },
            {
                "name": "Long-term Debt",
                "period": "2021",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 254374,
                "prev": 271686,
                "unit": "$M",
                "metric": "Long-term Debt",
            },
            {
                "name": "Long-term Debt",
                "period": "2020",
                "category": "Balance Sheet",
                "segment": "Citigroup",
                "value": 271686,
                "prev": 231128,
                "unit": "$M",
                "metric": "Long-term Debt",
            },
            {
                "name": "Common Equity",
                "period": "2024",
                "category": "Balance Sheet",
                "segment": "Common Stockholders",
                "value": 190748,
                "prev": 187853,
                "unit": "$M",
                "metric": "Common Equity",
            },
            {
                "name": "Common Equity",
                "period": "2023",
                "category": "Balance Sheet",
                "segment": "Common Stockholders",
                "value": 187853,
                "prev": 182194,
                "unit": "$M",
                "metric": "Common Equity",
            },
            {
                "name": "Common Equity",
                "period": "2022",
                "category": "Balance Sheet",
                "segment": "Common Stockholders",
                "value": 182194,
                "prev": 182977,
                "unit": "$M",
                "metric": "Common Equity",
            },
            {
                "name": "Common Equity",
                "period": "2021",
                "category": "Balance Sheet",
                "segment": "Common Stockholders",
                "value": 182977,
                "prev": 179962,
                "unit": "$M",
                "metric": "Common Equity",
            },
            {
                "name": "Common Equity",
                "period": "2020",
                "category": "Balance Sheet",
                "segment": "Common Stockholders",
                "value": 179962,
                "prev": 175262,
                "unit": "$M",
                "metric": "Common Equity",
            },
            {
                "name": "Total Equity",
                "period": "2024",
                "category": "Balance Sheet",
                "segment": "Total Stockholders",
                "value": 208598,
                "prev": 205453,
                "unit": "$M",
                "metric": "Total Equity",
            },
            {
                "name": "Total Equity",
                "period": "2023",
                "category": "Balance Sheet",
                "segment": "Total Stockholders",
                "value": 205453,
                "prev": 201189,
                "unit": "$M",
                "metric": "Total Equity",
            },
            {
                "name": "Total Equity",
                "period": "2022",
                "category": "Balance Sheet",
                "segment": "Total Stockholders",
                "value": 201189,
                "prev": 201972,
                "unit": "$M",
                "metric": "Total Equity",
            },
            {
                "name": "Total Equity",
                "period": "2021",
                "category": "Balance Sheet",
                "segment": "Total Stockholders",
                "value": 201972,
                "prev": 199442,
                "unit": "$M",
                "metric": "Total Equity",
            },
            {
                "name": "Total Equity",
                "period": "2020",
                "category": "Balance Sheet",
                "segment": "Total Stockholders",
                "value": 199442,
                "prev": 196228,
                "unit": "$M",
                "metric": "Total Equity",
            },
            # ── Performance Metrics ────────────────────────────────────────────
            {
                "name": "ROTA (%)",
                "period": "2024",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 0.51,
                "prev": 0.38,
                "unit": "%",
                "metric": "Return on Avg Assets",
            },
            {
                "name": "ROTA (%)",
                "period": "2023",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 0.38,
                "prev": 0.62,
                "unit": "%",
                "metric": "Return on Avg Assets",
            },
            {
                "name": "ROTA (%)",
                "period": "2022",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 0.62,
                "prev": 0.94,
                "unit": "%",
                "metric": "Return on Avg Assets",
            },
            {
                "name": "ROTA (%)",
                "period": "2021",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 0.94,
                "prev": 0.50,
                "unit": "%",
                "metric": "Return on Avg Assets",
            },
            {
                "name": "ROTA (%)",
                "period": "2020",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 0.50,
                "prev": 0.47,
                "unit": "%",
                "metric": "Return on Avg Assets",
            },
            {
                "name": "ROCE Common (%)",
                "period": "2024",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 6.1,
                "prev": 4.3,
                "unit": "%",
                "metric": "Return on Common Equity",
            },
            {
                "name": "ROCE Common (%)",
                "period": "2023",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 4.3,
                "prev": 7.7,
                "unit": "%",
                "metric": "Return on Common Equity",
            },
            {
                "name": "ROCE Common (%)",
                "period": "2022",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 7.7,
                "prev": 11.5,
                "unit": "%",
                "metric": "Return on Common Equity",
            },
            {
                "name": "ROCE Common (%)",
                "period": "2021",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 11.5,
                "prev": 5.7,
                "unit": "%",
                "metric": "Return on Common Equity",
            },
            {
                "name": "ROCE Common (%)",
                "period": "2020",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 5.7,
                "prev": 10.6,
                "unit": "%",
                "metric": "Return on Common Equity",
            },
            {
                "name": "RoTCE (%)",
                "period": "2024",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 7.0,
                "prev": 4.9,
                "unit": "%",
                "metric": "Return on Tangible Common Equity",
            },
            {
                "name": "RoTCE (%)",
                "period": "2023",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 4.9,
                "prev": 8.9,
                "unit": "%",
                "metric": "Return on Tangible Common Equity",
            },
            {
                "name": "RoTCE (%)",
                "period": "2022",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 8.9,
                "prev": 13.4,
                "unit": "%",
                "metric": "Return on Tangible Common Equity",
            },
            {
                "name": "RoTCE (%)",
                "period": "2021",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 13.4,
                "prev": 6.6,
                "unit": "%",
                "metric": "Return on Tangible Common Equity",
            },
            {
                "name": "RoTCE (%)",
                "period": "2020",
                "category": "Performance Metrics",
                "segment": "Common Stockholders",
                "value": 6.6,
                "prev": 12.1,
                "unit": "%",
                "metric": "Return on Tangible Common Equity",
            },
            {
                "name": "Efficiency Ratio (%)",
                "period": "2024",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 66.5,
                "prev": 71.8,
                "unit": "%",
                "metric": "Efficiency Ratio",
            },
            {
                "name": "Efficiency Ratio (%)",
                "period": "2023",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 71.8,
                "prev": 68.1,
                "unit": "%",
                "metric": "Efficiency Ratio",
            },
            {
                "name": "Efficiency Ratio (%)",
                "period": "2022",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 68.1,
                "prev": 67.0,
                "unit": "%",
                "metric": "Efficiency Ratio",
            },
            {
                "name": "Efficiency Ratio (%)",
                "period": "2021",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 67.0,
                "prev": 58.8,
                "unit": "%",
                "metric": "Efficiency Ratio",
            },
            {
                "name": "Efficiency Ratio (%)",
                "period": "2020",
                "category": "Performance Metrics",
                "segment": "Citigroup",
                "value": 58.8,
                "prev": 57.0,
                "unit": "%",
                "metric": "Efficiency Ratio",
            },
            # ── Basel III Ratios ───────────────────────────────────────────────
            {
                "name": "CET1 Capital (%)",
                "period": "2024",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 13.63,
                "prev": 13.37,
                "unit": "%",
                "metric": "CET1 Capital Ratio",
            },
            {
                "name": "CET1 Capital (%)",
                "period": "2023",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 13.37,
                "prev": 13.03,
                "unit": "%",
                "metric": "CET1 Capital Ratio",
            },
            {
                "name": "CET1 Capital (%)",
                "period": "2022",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 13.03,
                "prev": 12.25,
                "unit": "%",
                "metric": "CET1 Capital Ratio",
            },
            {
                "name": "CET1 Capital (%)",
                "period": "2021",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 12.25,
                "prev": 11.51,
                "unit": "%",
                "metric": "CET1 Capital Ratio",
            },
            {
                "name": "CET1 Capital (%)",
                "period": "2020",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 11.51,
                "prev": 11.86,
                "unit": "%",
                "metric": "CET1 Capital Ratio",
            },
            {
                "name": "Tier 1 Capital (%)",
                "period": "2024",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 15.31,
                "prev": 15.02,
                "unit": "%",
                "metric": "Tier 1 Capital Ratio",
            },
            {
                "name": "Tier 1 Capital (%)",
                "period": "2023",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 15.02,
                "prev": 14.80,
                "unit": "%",
                "metric": "Tier 1 Capital Ratio",
            },
            {
                "name": "Tier 1 Capital (%)",
                "period": "2022",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 14.80,
                "prev": 13.91,
                "unit": "%",
                "metric": "Tier 1 Capital Ratio",
            },
            {
                "name": "Tier 1 Capital (%)",
                "period": "2021",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 13.91,
                "prev": 13.06,
                "unit": "%",
                "metric": "Tier 1 Capital Ratio",
            },
            {
                "name": "Tier 1 Capital (%)",
                "period": "2020",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 13.06,
                "prev": 13.22,
                "unit": "%",
                "metric": "Tier 1 Capital Ratio",
            },
            {
                "name": "Total Capital (%)",
                "period": "2024",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 15.42,
                "prev": 15.13,
                "unit": "%",
                "metric": "Total Capital Ratio",
            },
            {
                "name": "Total Capital (%)",
                "period": "2023",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 15.13,
                "prev": 15.46,
                "unit": "%",
                "metric": "Total Capital Ratio",
            },
            {
                "name": "Total Capital (%)",
                "period": "2022",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 15.46,
                "prev": 16.04,
                "unit": "%",
                "metric": "Total Capital Ratio",
            },
            {
                "name": "Total Capital (%)",
                "period": "2021",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 16.04,
                "prev": 15.33,
                "unit": "%",
                "metric": "Total Capital Ratio",
            },
            {
                "name": "Total Capital (%)",
                "period": "2020",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 15.33,
                "prev": 15.38,
                "unit": "%",
                "metric": "Total Capital Ratio",
            },
            {
                "name": "Supp. Leverage (%)",
                "period": "2024",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 5.85,
                "prev": 5.82,
                "unit": "%",
                "metric": "Supplementary Leverage Ratio",
            },
            {
                "name": "Supp. Leverage (%)",
                "period": "2023",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 5.82,
                "prev": 5.82,
                "unit": "%",
                "metric": "Supplementary Leverage Ratio",
            },
            {
                "name": "Supp. Leverage (%)",
                "period": "2022",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 5.82,
                "prev": 5.73,
                "unit": "%",
                "metric": "Supplementary Leverage Ratio",
            },
            {
                "name": "Supp. Leverage (%)",
                "period": "2021",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 5.73,
                "prev": 6.99,
                "unit": "%",
                "metric": "Supplementary Leverage Ratio",
            },
            {
                "name": "Supp. Leverage (%)",
                "period": "2020",
                "category": "Basel III Ratios",
                "segment": "Capital",
                "value": 6.99,
                "prev": 6.72,
                "unit": "%",
                "metric": "Supplementary Leverage Ratio",
            },
            {
                "name": "TBVPS ($)",
                "period": "2024",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 89.34,
                "prev": 86.19,
                "unit": "$",
                "metric": "Tangible Book Value Per Share",
            },
            {
                "name": "TBVPS ($)",
                "period": "2023",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 86.19,
                "prev": 81.65,
                "unit": "$",
                "metric": "Tangible Book Value Per Share",
            },
            {
                "name": "TBVPS ($)",
                "period": "2022",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 81.65,
                "prev": 79.16,
                "unit": "$",
                "metric": "Tangible Book Value Per Share",
            },
            {
                "name": "TBVPS ($)",
                "period": "2021",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 79.16,
                "prev": 73.67,
                "unit": "$",
                "metric": "Tangible Book Value Per Share",
            },
            {
                "name": "TBVPS ($)",
                "period": "2020",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 73.67,
                "prev": 69.56,
                "unit": "$",
                "metric": "Tangible Book Value Per Share",
            },
            {
                "name": "Dividend Payout (%)",
                "period": "2024",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 37,
                "prev": 51,
                "unit": "%",
                "metric": "Dividend Payout Ratio",
            },
            {
                "name": "Dividend Payout (%)",
                "period": "2023",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 51,
                "prev": 29,
                "unit": "%",
                "metric": "Dividend Payout Ratio",
            },
            {
                "name": "Dividend Payout (%)",
                "period": "2022",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 29,
                "prev": 20,
                "unit": "%",
                "metric": "Dividend Payout Ratio",
            },
            {
                "name": "Dividend Payout (%)",
                "period": "2021",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 20,
                "prev": 43,
                "unit": "%",
                "metric": "Dividend Payout Ratio",
            },
            {
                "name": "Dividend Payout (%)",
                "period": "2020",
                "category": "Capital",
                "segment": "Common Stockholders",
                "value": 43,
                "prev": 30,
                "unit": "%",
                "metric": "Dividend Payout Ratio",
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


# ── Metric pre-filter for multi-metric datasets (e.g. Citi) ──────────────────
# Maps common prompt keywords / abbreviations → exact "name" values in Citi data.
_CITI_METRIC_ALIASES: Dict[str, str] = {
    "tbvps": "TBVPS ($)",
    "tangible book value per share": "TBVPS ($)",
    "tangible book": "TBVPS ($)",
    "dividend payout": "Dividend Payout (%)",
    "rota (%)": "ROTA (%)",
    "rota": "ROTA (%)",
    "return on avg assets": "ROTA (%)",
    "roce common (%)": "ROCE Common (%)",
    "roce common": "ROCE Common (%)",
    "return on common equity": "ROCE Common (%)",
    "rotce (%)": "RoTCE (%)",
    "rotce": "RoTCE (%)",
    "return on tangible common equity": "RoTCE (%)",
    "efficiency ratio (%)": "Efficiency Ratio (%)",
    "efficiency ratio": "Efficiency Ratio (%)",
    "cet1 capital (%)": "CET1 Capital (%)",
    "cet1 capital": "CET1 Capital (%)",
    "cet1": "CET1 Capital (%)",
    "tier 1 capital (%)": "Tier 1 Capital (%)",
    "tier 1 capital": "Tier 1 Capital (%)",
    "total capital (%)": "Total Capital (%)",
    "supplementary leverage": "Supp. Leverage (%)",
    "supp. leverage (%)": "Supp. Leverage (%)",
    "supp. leverage": "Supp. Leverage (%)",
    "supp leverage": "Supp. Leverage (%)",
    "total assets": "Total Assets",
    "total deposits": "Total Deposits",
    "long-term debt": "Long-term Debt",
    "common equity": "Common Equity",
    "total equity": "Total Equity",
}


def _narrow_by_metric(rows: List[Dict[str, Any]], prompt: str) -> List[Dict[str, Any]]:
    """Narrow multi-metric rows to only those matching the widget prompt.

    For Citi-style datasets each metric repeats across 5 periods. Without
    narrowing, KPIs sum all 15 metrics (→ $21B nonsense) and trend charts
    aggregate unrelated series together.

    Resolution order:
    1. Alias lookup   — handles abbreviations (TBVPS, CET1, ROTA …).
    2. Exact name     — prompt IS the metric name (rule-based widget prompts).
    3. Word-overlap   — picks the metric(s) whose significant words best match;
                        returns all tied-best so comparison charts still work.
    """
    import re as _re

    if not rows:
        return rows
    names = list({str(row.get("name", "")) for row in rows})
    if len(names) <= 1:
        return rows  # Already a single metric — nothing to do

    p = prompt.lower().strip()

    # 1. Alias lookup (longest match wins to avoid partial collisions)
    best_alias_len = 0
    best_canonical: Optional[str] = None
    for alias, canonical in _CITI_METRIC_ALIASES.items():
        if alias in p and len(alias) > best_alias_len and canonical in names:
            best_alias_len = len(alias)
            best_canonical = canonical
    if best_canonical:
        filtered = [r for r in rows if str(r.get("name", "")) == best_canonical]
        if filtered:
            return filtered

    # 2. Exact name match
    for name in names:
        if name.lower() == p:
            return [r for r in rows if str(r.get("name", "")) == name]

    # 3. Word-overlap scoring
    _stop = {
        "the",
        "and",
        "for",
        "per",
        "of",
        "in",
        "at",
        "to",
        "by",
        "as",
        "a",
        "an",
        "all",
        "with",
        "over",
        "show",
        "add",
        "get",
        "value",
        "values",
        "latest",
        "trend",
        "growth",
        "chart",
        "2020",
        "2024",
    }

    def _sig(s: str) -> set:
        return {
            w
            for w in _re.sub(r"[(%$,.]", "", s).lower().split()
            if len(w) > 2 and w not in _stop
        }

    prompt_words = _sig(p)
    scored = [(name, len(_sig(name) & prompt_words)) for name in names]
    best = max(s for _, s in scored)
    if best == 0:
        return rows  # No keyword match — return all rows unchanged

    matched_names = {name for name, s in scored if s == best}
    filtered = [r for r in rows if str(r.get("name", "")) in matched_names]
    return filtered if filtered else rows


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

    # Narrow multi-metric rows to only those matching this widget's prompt.
    # Skipped for report/grid which intentionally display all rows.
    if widget_type not in ("report", "grid"):
        rows = _narrow_by_metric(rows, prompt)

    if widget_type == "report":
        # Report widgets return all rows with all columns for the rich table renderer.
        return [dict(row) for row in rows]

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
        # When multiple periods are present use only the most recent (e.g. 2024)
        # so the KPI card shows the latest snapshot, not a cross-year aggregate.
        periods_present = sorted(
            {str(r.get("period", "")) for r in rows if r.get("period")}, reverse=True
        )
        if len(periods_present) > 1:
            latest = periods_present[0]
            latest_rows = [r for r in rows if str(r.get("period", "")) == latest]
            if latest_rows:
                rows = latest_rows

        # Detect unit from rows to choose formatting and aggregation strategy
        units = {str(row.get("unit", "")) for row in rows if row.get("unit")}
        unit = next(iter(units), "") if len(units) == 1 else ""

        def _change(cur: float, prv: float) -> str:
            sign = "+" if cur >= prv else ""
            pct = ((cur - prv) / abs(prv) * 100) if prv else 0.0
            return f"{sign}{pct:.1f}%"

        # Percentage metrics (ROTA, ROCE, CET1, Efficiency Ratio …)
        # Averaging across periods gives a meaningful multi-year mean.
        if unit == "%":
            vals = [float(row.get("value", 0)) for row in rows]
            prevs = [float(row.get("prev", 0)) for row in rows]
            cur = sum(vals) / len(vals) if vals else 0.0
            prv = sum(prevs) / len(prevs) if prevs else 0.0
            return [
                {
                    "value": f"{cur:.2f}%",
                    "change": _change(cur, prv),
                    "positive": cur >= prv,
                }
            ]

        # Per-share dollar metrics (TBVPS)
        if unit == "$":
            vals = [float(row.get("value", 0)) for row in rows]
            prevs = [float(row.get("prev", 0)) for row in rows]
            cur = sum(vals) / len(vals) if vals else 0.0
            prv = sum(prevs) / len(prevs) if prevs else 0.0
            return [
                {
                    "value": f"${cur:.2f}",
                    "change": _change(cur, prv),
                    "positive": cur >= prv,
                }
            ]

        # Risk pseudo-metric
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
        # Default: $M (trade data and Citi Balance Sheet filtered to one year)
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

    # Auto-deduplicate: if the chosen x-axis key produces duplicate values (e.g.
    # Citi financial data where "period" appears 15 times, once per metric),
    # aggregate rather than returning raw rows — otherwise recharts zigzags wildly.
    # The aggregated data keeps the original key name so the frontend XAxis
    # dataKey (cfg.xAxisKey) always matches the returned field name.
    if widget_type in ("bar", "area", "line") and rows:
        xk = x_axis_key or "name"
        x_vals = [row.get(xk) for row in rows]
        if len(x_vals) != len(set(x_vals)):
            return _aggregate_by_key(rows, xk)

    # Sort by time-series key ascending so charts display naturally (2020 → 2024)
    if (
        x_axis_key
        and x_axis_key not in {"name"}
        and widget_type in ("bar", "area", "line")
    ):
        rows = sorted(rows, key=lambda r: str(r.get(x_axis_key, "")))

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
    report = "report"
    filter_select = "filter-select"
    filter_range = "filter-range"


class _XAxisKey(str, Enum):
    name = "name"
    imports_exports = "imports_exports"
    industries = "industries"
    products = "products"
    region = "region"
    country = "country"
    period = "period"
    category = "category"
    segment = "segment"
    metric = "metric"


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
            "3=full-width (heatmap/text/report)."
        )
    )
    height: Literal[1, 2, 3] = Field(
        default=1,
        description=(
            "Row-span height: 1=compact (kpi/filter/pie), "
            "2=medium (charts/grid), "
            "3=tall (report/heatmap/text with lots of data)."
        ),
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
      "widgetType": "<bar|area|line|pie|heatmap|kpi|grid|text|report|filter-select|filter-range>",
      "title": "<3-5 word title>",
      "prompt": "<what data to show; for filter-select/filter-range use the column name>",
      "span": <1|2|3>,
      "height": <1|2|3>,
      "xAxisKey": "<name|imports_exports|industries|products|region|country|period|category|segment|metric>"
    }}
  ]
}}

SPAN RULES (mandatory):
  kpi=1  pie=1  filter-select=1  filter-range=1
  bar=2  area=2  line=2  grid=2
  heatmap=3  text=3  report=3

HEIGHT RULES — row-span (1=compact ~220px, 2=medium ~460px, 3=tall ~700px):
  kpi=1  pie=1  filter-select=1  filter-range=1
  bar=2  area=2  line=2  grid=2
  heatmap=3  text=3  report=3  (height=2 only for very small report tables)

XAXISKEY RULES:
  monthly / time-series trend  →  name
  group by industry             →  industries
  group by product              →  products
  group by region               →  region
  group by country              →  country
  imports vs exports            →  imports_exports
  text, grid or report (all rows) →  name
  Citi financial by year/period  →  period
  Citi financial by category     →  category
  Citi financial by metric name  →  metric
  Citi financial by segment      →  segment

DATA SOURCE: {source_id}
COLUMNS: name (Jan-Jul months OR metric name), imports_exports (Imports|Exports),
  industries ({industries}), products ({products}),
  region (APAC|EMEA|Americas), country, value (trade value), prev (prior period)
  [citi-financial-summary also has: period (2020-2024), category, segment, metric, unit]

EXISTING WIDGETS: {existing_widgets}

EXAMPLE — user asks "KPI and bar chart by industry":
{{"message":"Adding a total value KPI and a bar chart by industry.","actions":[{{"widgetType":"kpi","title":"Total Trade Value","prompt":"Headline total trade value","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"bar","title":"Trade by Industry","prompt":"Compare trade value by industry","span":2,"height":2,"xAxisKey":"industries"}}]}}

EXAMPLE — user asks "full overview with KPIs, bar chart, and filters":
{{"message":"Building a full trade overview with KPI cards, a bar chart, and filter controls.","actions":[{{"widgetType":"kpi","title":"Total Trade Value","prompt":"Headline total trade value","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"YoY Change","prompt":"Period-over-period trade change","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"bar","title":"Trade by Industry","prompt":"Compare trade value across industries","span":2,"height":2,"xAxisKey":"industries"}},{{"widgetType":"filter-select","title":"Filter: Type","prompt":"imports_exports","span":1,"height":1,"xAxisKey":"imports_exports"}},{{"widgetType":"filter-select","title":"Filter: Industry","prompt":"industries","span":1,"height":1,"xAxisKey":"industries"}}]}}

EXAMPLE — user asks "show all data in a detailed report table":
{{"message":"Adding a full-width report table with all data rows, search, sort, and CSV export.","actions":[{{"widgetType":"report","title":"Full Data Report","prompt":"Show all data in a detailed report table","span":3,"height":3,"xAxisKey":"name"}}]}}

EXAMPLE — user asks "Citi financial summary report by category":
{{"message":"Adding a report table of Citi financial data grouped by category.","actions":[{{"widgetType":"report","title":"Citi Financial Report","prompt":"Show all Citi financial metrics by category","span":3,"height":3,"xAxisKey":"category"}}]}}

EXAMPLE — user asks "Citi executive: period filter, Total Assets, Deposits & Equity KPIs, and full report":
{{"message":"Building a Citi executive scorecard with a period filter, 3 balance sheet KPI cards, and a complete financial report.","actions":[{{"widgetType":"filter-select","title":"Filter: Period","prompt":"period","span":1,"height":1,"xAxisKey":"period"}},{{"widgetType":"kpi","title":"Total Assets","prompt":"Total Assets","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"Total Deposits","prompt":"Total Deposits","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"Common Equity","prompt":"Common Equity","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"filter-select","title":"Filter: Category","prompt":"category","span":1,"height":1,"xAxisKey":"category"}},{{"widgetType":"report","title":"Citi Financial Report","prompt":"Show all Citi financial metrics with period, category, value and year-over-year change","span":3,"height":3,"xAxisKey":"name"}}]}}

EXAMPLE — user asks "Show Basel III ratios: CET1, Tier 1 & Total Capital bar chart with compliance KPIs":
{{"message":"Adding CET1, Tier 1, and Total Capital ratio KPI cards plus a Basel III bar chart comparing all ratios by metric name.","actions":[{{"widgetType":"kpi","title":"CET1 Capital Ratio","prompt":"CET1 Capital (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"Tier 1 Capital","prompt":"Tier 1 Capital (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"Supp. Leverage Ratio","prompt":"Supp. Leverage (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"bar","title":"Basel III Capital Ratios","prompt":"Compare Basel III capital ratios CET1, Tier 1, Total Capital, and Supplementary Leverage by metric name","span":3,"height":2,"xAxisKey":"name"}}]}}

EXAMPLE — user asks "Add ROTA, ROCE & RoTCE profitability KPIs with 5-year category bar chart":
{{"message":"Adding profitability KPI cards for ROTA, ROCE, and RoTCE alongside a 5-year performance metrics bar chart.","actions":[{{"widgetType":"kpi","title":"ROTA (%)","prompt":"ROTA (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"ROCE Common (%)","prompt":"ROCE Common (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"RoTCE (%)","prompt":"RoTCE (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"bar","title":"Profitability Metrics","prompt":"Compare all performance metrics ROTA ROCE RoTCE Efficiency Ratio by metric name","span":3,"height":2,"xAxisKey":"name"}}]}}

EXAMPLE — user asks "Show TBVPS growth as area chart, Dividend Payout KPI, and Efficiency Ratio trend":
{{"message":"Adding TBVPS 5-year area chart, Dividend Payout KPI, and Efficiency Ratio trend line chart.","actions":[{{"widgetType":"kpi","title":"Dividend Payout","prompt":"Dividend Payout (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"Efficiency Ratio","prompt":"Efficiency Ratio (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"area","title":"TBVPS 5-Year Growth","prompt":"TBVPS ($)","span":2,"height":2,"xAxisKey":"period"}},{{"widgetType":"line","title":"Efficiency Ratio Trend","prompt":"Efficiency Ratio (%)","span":2,"height":2,"xAxisKey":"period"}}]}}

EXAMPLE — user asks "Build full Citi dashboard: category heatmap, capital KPIs, and financial report":
{{"message":"Building a comprehensive Citi dashboard with a category heatmap, key capital KPIs, period and category filters, and a full financial report.","actions":[{{"widgetType":"filter-select","title":"Filter: Period","prompt":"period","span":1,"height":1,"xAxisKey":"period"}},{{"widgetType":"filter-select","title":"Filter: Category","prompt":"category","span":1,"height":1,"xAxisKey":"category"}},{{"widgetType":"kpi","title":"Total Assets","prompt":"Total Assets","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"CET1 Capital Ratio","prompt":"CET1 Capital (%)","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"kpi","title":"Common Equity","prompt":"Common Equity","span":1,"height":1,"xAxisKey":"name"}},{{"widgetType":"heatmap","title":"Financial Metrics Heatmap","prompt":"Heatmap of all Citi financial metrics across categories","span":3,"height":3,"xAxisKey":"name"}},{{"widgetType":"report","title":"Full Citi Report","prompt":"Complete Citi financial data table with all metrics, periods, categories and values","span":3,"height":3,"xAxisKey":"name"}}]}}

EXAMPLE — user asks "Show Citi balance sheet metrics across 2020-2024 by year as bar chart with report":
{{"message":"Adding a 5-year balance sheet bar chart by period and a detailed balance sheet report table.","actions":[{{"widgetType":"bar","title":"Balance Sheet by Year","prompt":"Total Assets, Total Deposits, Long-term Debt, and equity values aggregated by period 2020-2024","span":3,"height":2,"xAxisKey":"period"}},{{"widgetType":"report","title":"Balance Sheet Report","prompt":"Show all Balance Sheet metrics with period and year-over-year values","span":3,"height":3,"xAxisKey":"name"}}]}}

USER REQUEST: {user_message}

JSON output:
"""


# ── helpers for rule-based fallback ──────────────────────────────────────────


def _w(
    widget_type: str, title: str, prompt: str, span: int, x: str, height: int = 1
) -> dict:
    return {
        "type": "add_widget",
        "widgetType": widget_type,
        "title": title,
        "prompt": prompt,
        "span": span,
        "height": height,
        "xAxisKey": x,
    }


def _rule_based_widgets(message: str, source_id: str = "global-trade") -> list:
    """Keyword-based widget builder used when LLM returns no actions."""
    m = message.lower()
    widgets: list = []

    # ── Citi-specific banking dashboards ─────────────────────────────────────
    if any(k in m for k in ("citi executive", "citi full", "full citi")):
        return [
            _w("filter-select", "Filter: Period", "period", 1, "period", 1),
            _w("filter-select", "Filter: Category", "category", 1, "category", 1),
            _w("kpi", "Total Assets", "Total Assets", 1, "name", 1),
            _w("kpi", "CET1 Capital Ratio", "CET1 Capital (%)", 1, "name", 1),
            _w("kpi", "Common Equity", "Common Equity", 1, "name", 1),
            _w(
                "heatmap",
                "Financial Metrics Heatmap",
                "Heatmap of all Citi financial metrics across categories",
                3,
                "name",
                3,
            ),
            _w(
                "report",
                "Full Citi Report",
                "Complete Citi financial data table with all metrics, periods, categories and values",
                3,
                "name",
                3,
            ),
        ]

    if any(
        k in m
        for k in ("cet1", "tier 1", "tier1", "basel", "capital ratio", "total capital")
    ):
        return [
            _w("kpi", "CET1 Capital Ratio", "CET1 Capital (%)", 1, "name", 1),
            _w("kpi", "Tier 1 Capital", "Tier 1 Capital (%)", 1, "name", 1),
            _w(
                "kpi",
                "Supp. Leverage Ratio",
                "Supp. Leverage (%)",
                1,
                "name",
                1,
            ),
            _w(
                "bar",
                "Basel III Capital Ratios",
                "Compare Basel III capital ratios CET1, Tier 1, Total Capital by metric name",
                3,
                "name",
                2,
            ),
        ]

    if any(k in m for k in ("rota", "roce", "rotce", "profitability", "return on")):
        return [
            _w("kpi", "ROTA (%)", "ROTA (%)", 1, "name", 1),
            _w("kpi", "ROCE Common (%)", "ROCE Common (%)", 1, "name", 1),
            _w(
                "kpi",
                "RoTCE (%)",
                "RoTCE (%)",
                1,
                "name",
                1,
            ),
            _w(
                "bar",
                "Profitability Metrics",
                "Compare all performance metrics ROTA ROCE RoTCE Efficiency Ratio by metric name",
                3,
                "name",
                2,
            ),
        ]

    if any(
        k in m
        for k in ("tbvps", "tangible book", "dividend payout", "book value per share")
    ):
        return [
            _w("kpi", "Dividend Payout", "Dividend Payout (%)", 1, "name", 1),
            _w(
                "kpi",
                "TBVPS",
                "TBVPS ($)",
                1,
                "name",
                1,
            ),
            _w(
                "area",
                "TBVPS 5-Year Growth",
                "TBVPS ($)",
                2,
                "period",
                2,
            ),
            _w(
                "line",
                "Efficiency Ratio Trend",
                "Efficiency Ratio (%)",
                2,
                "period",
                2,
            ),
        ]

    if any(
        k in m
        for k in ("balance sheet", "total assets", "total deposits", "long-term debt")
    ):
        return [
            _w("filter-select", "Filter: Period", "period", 1, "period", 1),
            _w("kpi", "Total Assets", "Total Assets", 1, "name", 1),
            _w("kpi", "Total Deposits", "Total Deposits", 1, "name", 1),
            _w("kpi", "Common Equity", "Common Equity", 1, "name", 1),
            _w(
                "bar",
                "Balance Sheet by Year",
                "Total Assets, Total Deposits, Long-term Debt, and equity by period 2020-2024",
                3,
                "period",
                2,
            ),
            _w(
                "report",
                "Balance Sheet Report",
                "Show all Balance Sheet metrics with period and year-over-year values",
                3,
                "name",
                3,
            ),
        ]

    if any(k in m for k in ("efficiency ratio", "efficiency")):
        return [
            _w("filter-select", "Filter: Category", "category", 1, "category", 1),
            _w("kpi", "Efficiency Ratio", "Efficiency Ratio (%)", 1, "name", 1),
            _w(
                "line",
                "Efficiency Ratio Trend",
                "Efficiency Ratio (%)",
                2,
                "period",
                2,
            ),
            _w(
                "text",
                "Performance Summary",
                "Executive summary of Citi performance metrics and efficiency trends 2020-2024",
                3,
                "name",
                2,
            ),
        ]

    # ── Generic trade dashboards ──────────────────────────────────────────────
    if any(k in m for k in ("full", "overview", "complete")):
        return [
            _w("kpi", "Total Trade Value", "Headline total trade value", 1, "name", 1),
            _w("kpi", "YoY Change", "Period-over-period trade change", 1, "name", 1),
            _w(
                "bar",
                "Trade by Industry",
                "Compare trade value by industry",
                2,
                "industries",
                2,
            ),
            _w(
                "filter-select",
                "Filter: Type",
                "imports_exports",
                1,
                "imports_exports",
                1,
            ),
            _w("filter-select", "Filter: Industry", "industries", 1, "industries", 1),
        ]
    if "manufacturing" in m and "risk" in m:
        return [
            _w("kpi", "Risk Score", "Manufacturing risk score", 1, "name", 1),
            _w("kpi", "Total Value", "Headline trade value", 1, "name", 1),
            _w(
                "heatmap",
                "Risk Heatmap",
                "Color intensity across months and metrics",
                3,
                "name",
                3,
            ),
            _w("bar", "Value by Country", "Compare value by country", 2, "country", 2),
            _w("filter-select", "Filter: Industry", "industries", 1, "industries", 1),
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
                    1,
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
                2,
            )
        )
    if any(k in m for k in ("area", "trend")):
        widgets.append(
            _w("area", "Trend Chart", "Monthly trend over time", 2, "name", 2)
        )
    if any(k in m for k in ("line chart", "line", "previous vs", "prev vs")):
        widgets.append(
            _w("line", "Line Chart", "Multi-series trend comparison", 2, "name", 2)
        )
    if "pie" in m:
        pie_x = (
            "industries"
            if "industr" in m
            else "products" if "product" in m else "imports_exports"
        )
        widgets.append(
            _w("pie", "Distribution", f"Distribution by {pie_x}", 1, pie_x, 1)
        )
    if "heatmap" in m:
        widgets.append(
            _w(
                "heatmap",
                "Heatmap",
                "Color intensity across months and metrics",
                3,
                "name",
                3,
            )
        )
    if "grid" in m or "table" in m or "rows" in m:
        widgets.append(
            _w("grid", "Data Grid", "All trade rows in tabular view", 2, "name", 2)
        )
    if any(k in m for k in ("report table", "report", "detailed")):
        widgets.append(
            _w(
                "report",
                "Data Report",
                "Show all data in a detailed report table",
                3,
                "name",
                3,
            )
        )
    if any(k in m for k in ("text", "summary", "executive")):
        widgets.append(
            _w(
                "text",
                "Report Summary",
                "Executive summary of current trade data",
                3,
                "name",
                2,
            )
        )
    if "filter" in m and "range" not in m:
        widgets.append(
            _w("filter-select", "Filter: Industry", "industries", 1, "industries", 1)
        )
    if "range filter" in m or "range" in m:
        widgets.append(_w("filter-range", "Trade Value Range", "value", 1, "name", 1))

    if not widgets:
        if source_id == "citi-financial-summary":
            widgets = [
                _w("filter-select", "Filter: Period", "period", 1, "period", 1),
                _w("kpi", "Total Assets", "Total Assets", 1, "name", 1),
                _w(
                    "kpi",
                    "CET1 Capital Ratio",
                    "CET1 Capital (%)",
                    1,
                    "name",
                    1,
                ),
                _w(
                    "bar",
                    "Balance Sheet by Year",
                    "Total Assets and Deposits by period 2020-2024",
                    3,
                    "period",
                    2,
                ),
            ]
        else:
            widgets = [
                _w(
                    "kpi",
                    "Total Trade Value",
                    "Headline total trade value",
                    1,
                    "name",
                    1,
                ),
                _w(
                    "bar",
                    "Trade by Industry",
                    "Compare trade value by industry",
                    2,
                    "industries",
                    2,
                ),
                _w(
                    "filter-select",
                    "Filter: Type",
                    "imports_exports",
                    1,
                    "imports_exports",
                    1,
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
                    "height": a.height,
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
                    wt = a.get("widgetType")
                    xk = a.get("xAxisKey")
                    if wt in valid_types and (xk in valid_keys or xk is None):
                        actions.append(
                            {
                                "type": "add_widget",
                                "widgetType": a["widgetType"],
                                "title": str(a.get("title", a["widgetType"])),
                                "prompt": str(a.get("prompt", "")),
                                "span": int(a.get("span", 2)),
                                "height": int(a.get("height", 1)),
                                "xAxisKey": a["xAxisKey"],
                            }
                        )
                response_message = str(parsed.get("message", ""))
        except Exception:
            pass

    # ── Tier 3: rule-based fallback ───────────────────────────────────────────
    if not actions:
        actions = _rule_based_widgets(payload.message, payload.sourceId)
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
