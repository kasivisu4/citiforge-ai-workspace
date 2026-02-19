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
            type="form",
            title="Review and approve data model plan",
            message="Provide the final details, then submit the approval.",
            fields=[
                HITLFormField(
                    name="approval_notes",
                    label="Approval notes",
                    type="textarea",
                    required=False,
                    default="",
                ),
                HITLFormField(
                    name="target_table",
                    label="Target table name",
                    type="text",
                    required=True,
                    default="products",
                ),
                HITLFormField(
                    name="risk_reviewed",
                    label="Risk review completed",
                    type="boolean",
                    required=False,
                    default=False,
                ),
            ],
            style={"variant": "card"},
            metadata={
                "hint": "Submit the form to continue, or modify in chat before submitting."
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
