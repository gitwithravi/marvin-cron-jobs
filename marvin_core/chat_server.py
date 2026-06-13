import os
import sys
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from marvin_core.agent import process_message, execute_task, read_report, format_response
from marvin_core.alerts import generate_alert, read_latest_alert
from marvin_core.env import load_root_env
from marvin_core.todos import (
    classify_and_apply_tags,
    create_tag,
    create_todo,
    list_tags,
    list_todos,
    retag_todo,
    update_todo,
)

load_root_env()

app = FastAPI(title="MARVIN Chat Server")


class ChatRequest(BaseModel):
    message: str


class ConfirmRequest(BaseModel):
    task_name: str
    confirmed: bool
    params: dict[str, Any] | None = None


class TodoCreateRequest(BaseModel):
    title: str
    notes: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: str | None = None
    deadline_text: str | None = None
    tag_ids: list[int] | None = None


class TodoUpdateRequest(BaseModel):
    title: str | None = None
    notes: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: str | None = None
    tag_ids: list[int] | None = None


class TodoRetagRequest(BaseModel):
    tag_ids: list[int]


class TagCreateRequest(BaseModel):
    name: str
    description: str | None = None


@app.post("/chat")
def chat_endpoint(payload: ChatRequest):
    try:
        response = process_message(payload.message)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/confirm")
def chat_confirm_endpoint(payload: ConfirmRequest):
    if not payload.confirmed:
        return {
            "type": "response",
            "message": "Task execution cancelled. A wise choice to preserve compute resources.",
        }

    try:
        # Execute the task
        result = execute_task(payload.task_name, payload.params)
        if result["status"] == "success":
            # Read the generated report
            report_content = read_report(payload.task_name, payload.params)
            # Format the output sardonically
            formatted = format_response(
                report_content,
                "execute",
                f"Task {payload.task_name} was run. Here are the results.",
            )
            return {"type": "response", "message": formatted}
        else:
            error_msg = result["error"]
            formatted = format_response(
                f"Task execution failed: {error_msg}",
                "execute",
                f"The task {payload.task_name} failed.",
            )
            return {"type": "response", "message": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/todo-tags")
def todo_tags_endpoint():
    try:
        return {"tags": list_tags()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/todo-tags")
def create_todo_tag_endpoint(payload: TagCreateRequest):
    try:
        return {"tag": create_tag(payload.name, payload.description)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/todos")
def todos_endpoint(status: str | None = None, tag_id: int | None = None, include_done: bool = False):
    try:
        return {"todos": list_todos(status=status, tag_id=tag_id, include_done=include_done)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/todos")
def create_todo_endpoint(payload: TodoCreateRequest, background_tasks: BackgroundTasks):
    try:
        todo = create_todo(
            title=payload.title,
            notes=payload.notes,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            deadline_text=payload.deadline_text,
            tag_ids=payload.tag_ids,
            classify_tags=payload.tag_ids is not None,
        )
        if payload.tag_ids is None:
            background_tasks.add_task(classify_and_apply_tags, todo["id"])
        return {"todo": todo}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/todos/{todo_id}")
def update_todo_endpoint(todo_id: int, payload: TodoUpdateRequest):
    try:
        updates = payload.model_dump(exclude_unset=True)
        return {"todo": update_todo(todo_id, updates)}
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/todos/{todo_id}/retag")
def retag_todo_endpoint(todo_id: int, payload: TodoRetagRequest):
    try:
        return {"todo": retag_todo(todo_id, payload.tag_ids)}
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts/latest")
def latest_alert_endpoint(background_tasks: BackgroundTasks):
    try:
        alert = read_latest_alert()
        if not alert["exists"]:
            background_tasks.add_task(generate_alert)
        return alert
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/alerts/refresh")
def refresh_alert_endpoint(background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(generate_alert)
        return {
            "started": True,
            "message": "Generating your alert. Please check back in sometime.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.getenv("CHAT_SERVER_PORT", "3031"))
    uvicorn.run("marvin_core.chat_server:app", host="127.0.0.1", port=port, reload=False)
