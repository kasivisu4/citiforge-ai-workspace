from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import time
import uuid
import asyncio
from typing import List, Dict, Any

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


# SSE stream for chat + table streaming. Streams JSON events with named event types.
@app.get("/stream")
async def stream(request: Request, input: str = "", id: str = ""):
    # Simulate an LLM producing a plan, then emitting a structured table schema as JSON rows
    async def event_stream():
        # initial text chunks
        chunks = [
            "I will propose a table schema for your products. ",
            "First I will list columns and types. ",
            "Then I will stream sample rows.",
        ]
        for c in chunks:
            if await await_disconnect(request):
                return
            yield f"event: chunk\ndata: {c}\n\n"
            await asyncio.sleep(0.2)

        # Finalize a plan and emit a HITL prompt with options
        plan_text = (
            "Proposed schema: products (id, name, price, currency, available_since)"
        )
        hitl = {
            "type": "hitl",
            "title": "Approve data model plan",
            "description": "Approve the proposed table schema or modify it before applying.",
            "options": [
                {
                    "id": "approve_plan",
                    "label": "Approve Plan",
                    "action": "approve_plan",
                    "style": "primary",
                },
                {
                    "id": "modify",
                    "label": "Modify",
                    "action": "modify",
                    "style": "secondary",
                },
            ],
            "metadata": {"hint": "Approve to finalize, Modify to edit schema in chat."},
        }
        # send done event with plan + hitl and structured schema metadata
        table_schema = {
            "tableName": "products",
            "columns": [
                {
                    "name": "id",
                    "type": "string",
                    "nullable": False,
                    "description": "Primary key",
                },
                {
                    "name": "name",
                    "type": "string",
                    "nullable": False,
                    "description": "Product name",
                },
                {
                    "name": "price",
                    "type": "decimal",
                    "nullable": False,
                    "description": "Retail price",
                },
                {
                    "name": "currency",
                    "type": "string",
                    "nullable": False,
                    "description": "Currency code",
                },
                {
                    "name": "available_since",
                    "type": "datetime",
                    "nullable": True,
                    "description": "Availability date",
                },
            ],
            "rows": [
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
            ],
        }

        payload = {"content": plan_text, "meta": {"table": table_schema, "hitl": hitl}}
        yield f"event: done\ndata: {json.dumps(payload)}\n\n"

    # Fast helper to check client disconnect in generator context
    async def await_disconnect(req: Request):
        try:
            return await req.is_disconnected()
        except Exception:
            return True

    return StreamingResponse(event_stream(), media_type="text/event-stream")
