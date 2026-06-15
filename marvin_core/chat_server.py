import binascii
import os
import sys
from pathlib import Path
from typing import Any, Literal
from collections import Counter

import base64
import uvicorn

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel
from requests import RequestException
import importlib
import json
from marvin_core.db import connect, insert_marvin_summary
from marvin_core.communication_style import load_communication_style
from marvin_core.openrouter import OpenRouterClient

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from marvin_core.agent import process_message, execute_task, read_report, format_response
from marvin_core.alerts import generate_alert, read_latest_alert
from marvin_core.beszel_live import fetch_beszel_live_payload
from marvin_core.env import load_root_env, require_env
from marvin_core.config import load_yaml
from marvin_core.hermes import HermesClientError, HermesConfigError, chat_with_hermes
from marvin_core.invoices import create_invoice_draft, list_invoices, save_invoice
from marvin_core.todos import (
    classify_and_apply_tags,
    create_tag,
    create_todo,
    list_tags,
    list_todos,
    retag_todo,
    update_todo,
)
from tasks.team_status_today.client import TeamStatusAPIError, TeamStatusClient, _validate_date
from tasks.team_status_today.run import _require_real_env

load_root_env()

app = FastAPI(title="MARVIN Chat Server")

VALID_TEAM_STATUS_STATUSES = ("done", "in_progress", "blocked", "planned")


class ChatRequest(BaseModel):
    message: str


class HermesHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class HermesChatRequest(BaseModel):
    message: str
    history: list[HermesHistoryMessage] | None = None


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


class InvoiceSaveRequest(BaseModel):
    draft_id: str
    invoice_no: str | None = None
    invoice_date: str
    invoice_from: str
    amount_usd: float | None = None
    amount_inr: float | None = None
    original_filename: str
    extraction_model: str | None = None
    extraction_raw_json: dict[str, Any] | None = None
    usd_only_confirmed: bool | None = None


class InvoiceExtractRequest(BaseModel):
    filename: str
    pdf_base64: str


def _database_path_for_task(task_name: str | None = None) -> str:
    if task_name:
        config_path = ROOT_DIR / "tasks" / task_name / "config.yaml"
        if config_path.exists():
            config = load_yaml(config_path)
            if config.get("database_path"):
                return str(config["database_path"])
    return os.getenv("MARVIN_DATABASE_PATH", "data/marvin.sqlite3")


def build_team_status_payload(date: str) -> dict[str, Any]:
    _validate_date(date)
    api_url = _require_real_env("TEAM_STATUS_API_URL")
    api_key = _require_real_env("TEAM_STATUS_API_KEY")

    with TeamStatusClient(api_url, api_key) as client:
        members = client.fetch_team_members()
        member_payloads: list[dict[str, Any]] = []
        for member in members:
            member_id = member.get("id")
            tasks = client.fetch_tasks(member_id, date)
            status_counts = Counter((task.get("status") or "unknown") for task in tasks)
            normalized_counts = {
                status: status_counts.get(status, 0)
                for status in VALID_TEAM_STATUS_STATUSES
            }
            normalized_counts.update(
                {
                    status: count
                    for status, count in status_counts.items()
                    if status not in VALID_TEAM_STATUS_STATUSES
                }
            )
            member_payloads.append(
                {
                    "id": member_id,
                    "name": member.get("name") or f"member-{member_id}",
                    "task_count": len(tasks),
                    "status_counts": normalized_counts,
                    "tasks": tasks,
                }
            )

    return {"date": date, "members": member_payloads}


@app.post("/chat")
def chat_endpoint(payload: ChatRequest):
    try:
        response = process_message(payload.message)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/hermes/chat")
def hermes_chat_endpoint(payload: HermesChatRequest):
    try:
        history = [
            {"role": item.role, "content": item.content}
            for item in payload.history or []
        ]
        message = chat_with_hermes(payload.message, history)
        return {"type": "response", "message": message}
    except HermesConfigError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HermesClientError as e:
        raise HTTPException(status_code=502, detail=str(e))
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


@app.get("/invoices")
def invoices_endpoint(month: str | None = None):
    try:
        return list_invoices(month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/invoices/extract")
def extract_invoice_endpoint(payload: InvoiceExtractRequest):
    try:
        pdf_bytes = base64.b64decode(payload.pdf_base64, validate=True)
        return {"draft": create_invoice_draft(pdf_bytes, payload.filename)}
    except binascii.Error:
        raise HTTPException(status_code=400, detail="Invalid invoice PDF payload.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/invoices")
def create_invoice_endpoint(payload: InvoiceSaveRequest):
    try:
        return {"invoice": save_invoice(payload.model_dump())}
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/team-status")
def team_status_endpoint(date: str):
    try:
        return build_team_status_payload(date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TeamStatusAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/beszel")
def beszel_endpoint():
    try:
        return fetch_beszel_live_payload()
    except RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
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


@app.get("/runs")
def get_runs_endpoint(task_name: str | None = None):
    try:
        with connect(_database_path_for_task(task_name)) as conn:
            query = """
                SELECT
                    tr.id,
                    tr.task_name,
                    tr.started_at,
                    tr.finished_at,
                    tr.status,
                    tr.error,
                    trp.observed_at,
                    trp.risk_level,
                    EXISTS (
                        SELECT 1 FROM marvin_summaries ms WHERE ms.run_id = tr.id
                    ) as has_summary
                FROM task_runs tr
                JOIN task_run_payloads trp ON tr.id = trp.run_id
            """
            params = []
            if task_name:
                query += " WHERE tr.task_name = ?"
                params.append(task_name)
            query += " ORDER BY tr.id DESC"

            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/runs/{run_id}")
def get_run_endpoint(run_id: int, task_name: str | None = None):
    try:
        with connect(_database_path_for_task(task_name)) as conn:
            # Get the basic run info
            run_row = conn.execute(
                "SELECT id, task_name, started_at, finished_at, status, error FROM task_runs WHERE id = ?",
                (run_id,)
            ).fetchone()
            if not run_row:
                raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

            run_dict = dict(run_row)

            # Get payload
            payload_row = conn.execute(
                "SELECT observed_at, risk_level, factual_json, deterministic_analysis_json FROM task_run_payloads WHERE run_id = ?",
                (run_id,)
            ).fetchone()

            if payload_row:
                run_dict["observed_at"] = payload_row["observed_at"]
                run_dict["risk_level"] = payload_row["risk_level"]
                run_dict["factual_payload"] = json.loads(payload_row["factual_json"])
                run_dict["deterministic_analysis"] = json.loads(payload_row["deterministic_analysis_json"])
            else:
                run_dict["observed_at"] = None
                run_dict["risk_level"] = None
                run_dict["factual_payload"] = None
                run_dict["deterministic_analysis"] = None

            # Get cached summary
            summary_row = conn.execute(
                "SELECT model, summary_json, created_at FROM marvin_summaries WHERE run_id = ? LIMIT 1",
                (run_id,)
            ).fetchone()

            if summary_row:
                run_dict["summary"] = {
                    "model": summary_row["model"],
                    "summary_json": json.loads(summary_row["summary_json"]),
                    "created_at": summary_row["created_at"]
                }
            else:
                run_dict["summary"] = None

            return run_dict
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/runs/{run_id}/summary")
def generate_run_summary_endpoint(run_id: int, task_name: str | None = None):
    try:
        with connect(_database_path_for_task(task_name)) as conn:
            # 1. Fetch task run
            run_row = conn.execute(
                "SELECT task_name FROM task_runs WHERE id = ?",
                (run_id,)
            ).fetchone()
            if not run_row:
                raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

            task_name = run_row["task_name"]

            # 2. Load config for this task to get model and prompts directory
            task_dir = ROOT_DIR / "tasks" / task_name
            config_path = task_dir / "config.yaml"
            if not config_path.exists():
                raise HTTPException(status_code=404, detail=f"Task config for {task_name} not found")

            config = load_yaml(config_path)
            model = config.get("model", "deepseek/deepseek-v4-flash")

            # 3. Check if cached summary already exists for this run and model
            cached_row = conn.execute(
                "SELECT summary_json FROM marvin_summaries WHERE run_id = ? AND model = ?",
                (run_id, model)
            ).fetchone()
            if cached_row:
                return json.loads(cached_row["summary_json"])

            # 4. Fetch payload
            payload_row = conn.execute(
                "SELECT factual_json FROM task_run_payloads WHERE run_id = ?",
                (run_id,)
            ).fetchone()
            if not payload_row:
                raise HTTPException(status_code=400, detail="Task run payload not found, cannot summarize")

            factual_payload = json.loads(payload_row["factual_json"])

            # 5. Build prompt
            communication_style = load_communication_style()

            # Dynamically import build_messages
            try:
                analysis_module = importlib.import_module(f"tasks.{task_name}.analysis")
                build_messages = getattr(analysis_module, "build_messages")
            except (ImportError, AttributeError):
                raise HTTPException(status_code=500, detail=f"Failed to import build_messages for task {task_name}")

            messages = build_messages(
                prompts_dir=task_dir / "prompts",
                communication_style=communication_style,
                factual_payload=factual_payload,
            )

            # 6. Call OpenRouter
            api_key = os.getenv("OPENROUTER_API_KEY") or require_env("OPENROUTER_API_KEY")
            openrouter = OpenRouterClient(api_key)
            llm_config = config.get("openrouter") or {}

            analysis = openrouter.chat_json(
                model=model,
                messages=messages,
                temperature=float(llm_config.get("temperature", 0.2)),
                max_tokens=int(llm_config.get("max_tokens", 1200)),
            )

            # Ensure risk level is present
            if "risk_level" not in analysis:
                # Get risk level from DB
                risk_row = conn.execute(
                    "SELECT risk_level FROM task_run_payloads WHERE run_id = ?",
                    (run_id,)
                ).fetchone()
                analysis["risk_level"] = risk_row["risk_level"] if risk_row else "low"

            # 7. Store in marvin_summaries
            from datetime import datetime, timezone
            created_at = datetime.now(timezone.utc).isoformat()
            insert_marvin_summary(conn, run_id, model, analysis, created_at)

            return analysis
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    port = int(os.getenv("CHAT_SERVER_PORT", "3031"))
    uvicorn.run("marvin_core.chat_server:app", host="127.0.0.1", port=port, reload=False)
