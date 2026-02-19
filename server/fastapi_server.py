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
        input_text = payload.get("input", "")
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
        input_text = form.get("input", "") or ""
        message_id = form.get("id", "") or ""
        # Files can be attached in multipart uploads; consume to avoid warnings.
        _ = form.getlist("files") if hasattr(form, "getlist") else []
    else:
        input_text = request.query_params.get("input", "")
        message_id = request.query_params.get("id", "")

    if hitl_action_result is not None:
        result_payload = (
            hitl_action_result.model_dump()
            if hasattr(hitl_action_result, "model_dump")
            else hitl_action_result.dict()
        )
        print("[MOCK HITL] Received action result via /stream:", json.dumps(result_payload))

        async def hitl_result_stream():
            yield json.dumps(
                {
                    "type": "done",
                    "content": "HITL action result received.",
                    "meta": {"hitlActionResult": result_payload},
                }
            ) + "\n"

        return StreamingResponse(
            hitl_result_stream(), media_type="application/x-ndjson"
        )

    # Simulate an LLM producing a plan, then streaming table rows as objects
    async def event_stream():
        # Send step metadata first to indicate total steps
        yield json.dumps({"type": "step-metadata", "total": 3}) + "\n"

        # Step 1: Plan overview - yield step chunk to indicate execution starting
        yield json.dumps({"type": "step", "content": "Plan overview", "step": 1}) + "\n"

        chunks = [
            "I will propose a table schema for your products. ",
            "First I will list columns and types. ",
            "Then I will stream the table as rows.",
        ]
        for c in chunks:
            if await await_disconnect(request):
                return
            yield json.dumps({"type": "paragraph", "content": c}) + "\n"
            await asyncio.sleep(2)

        # Step 2: Stream table rows - yield step chunk to indicate execution starting
        yield json.dumps(
            {"type": "step", "content": "Stream table rows", "step": 2}
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
        for row in table_rows:
            if await await_disconnect(request):
                return
            yield json.dumps({"type": "table-row", "content": row}) + "\n"
            await asyncio.sleep(0.1)

        # Step 3: Finalize - yield step chunk to indicate execution starting
        yield json.dumps({"type": "step", "content": "Finalize", "step": 3}) + "\n"

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
            {"type": "done", "content": "", "meta": {"hitl": hitl_payload}}
        ) + "\n"

    # Fast helper to check client disconnect in generator context
    async def await_disconnect(req: Request):
        try:
            return await req.is_disconnected()
        except Exception:
            return True

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
