from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import time
import uuid
import asyncio
from typing import List, Dict, Any, Optional, Literal

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


class DashboardOptionsRequest(BaseModel):
    source: str
    column: str
    filters: Optional[Dict[str, Any]] = None


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
    widget_type: str, rows: List[Dict[str, Any]], prompt: str
) -> Any:
    prompt_lower = (prompt or "").lower()
    if widget_type == "filter-range":
        if not rows:
            return [0, 100]
        values = [int(row.get("value", 0)) for row in rows]
        return [min(values), max(values)]

    if widget_type == "pie":
        grouped: Dict[str, int] = {}
        group_column = "industries"
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

    return [dict(row) for row in rows]


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
    result = build_dashboard_response(payload.widgetType, rows, payload.prompt)
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
