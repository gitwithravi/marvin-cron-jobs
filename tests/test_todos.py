from marvin_core import todos


def use_tmp_db(monkeypatch, tmp_path):
    db_path = tmp_path / "marvin.sqlite3"
    monkeypatch.setattr(todos, "DATABASE_PATH", db_path)
    return db_path


def test_todo_migration_seeds_others_tag(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    tags = todos.list_tags()

    assert [tag["name"] for tag in tags] == ["Others"]
    assert tags[0]["is_protected"] is True


def test_create_todo_uses_llm_tag_ids(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    work = todos.create_tag("Work Delegation")
    vityarthi = todos.create_tag("VITyarthi")
    monkeypatch.setattr(todos, "classify_todo_tags", lambda _title, _tags: [work["id"], vityarthi["id"]])

    todo = todos.create_todo(title="Take followup from Aditya on VITyarthi data analysis")

    assert todo["title"] == "Take followup from Aditya on VITyarthi data analysis"
    assert {tag["name"] for tag in todo["tags"]} == {"Work Delegation", "VITyarthi"}
    assert todo["status"] == "inbox"
    assert todo["priority"] == "medium"


def test_create_todo_falls_back_to_others(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    todos.create_tag("Work Delegation")
    monkeypatch.setattr(todos, "classify_todo_tags", lambda _title, _tags: [])

    todo = todos.create_todo(title="Buy batteries")

    assert [tag["name"] for tag in todo["tags"]] == ["Others"]


def test_create_todo_can_defer_tag_classification(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    work = todos.create_tag("Work Delegation")
    monkeypatch.setattr(todos, "classify_todo_tags", lambda _title, _tags: [work["id"]])

    todo = todos.create_todo(
        title="Take followup from Aditya by 16th June",
        classify_tags=False,
    )

    assert [tag["name"] for tag in todo["tags"]] == ["Others"]
    assert todo["due_date"].endswith("-06-16")

    updated = todos.classify_and_apply_tags(todo["id"])
    assert updated is not None
    assert [tag["name"] for tag in updated["tags"]] == ["Work Delegation"]


def test_create_todo_parses_deadline_text(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    todo = todos.create_todo(
        title="Plan reporting cleanup",
        deadline_text="late july",
        classify_tags=False,
    )

    assert todo["due_date"].endswith("-07-25")


def test_filter_and_retag_todo(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    work = todos.create_tag("Work Delegation")
    personal = todos.create_tag("Personal")
    todo = todos.create_todo(title="Ask Aditya for update", tag_ids=[work["id"]], status="wip")
    todos.create_todo(title="Buy batteries", tag_ids=[personal["id"]], status="done")

    wip = todos.list_todos(status="wip")
    assert [item["id"] for item in wip] == [todo["id"]]

    retagged = todos.retag_todo(todo["id"], [personal["id"]])
    assert [tag["name"] for tag in retagged["tags"]] == ["Personal"]
    assert todos.list_todos(tag_id=work["id"]) == []
    assert [item["id"] for item in todos.list_todos(tag_id=personal["id"])] == [retagged["id"]]


def test_pending_on_others_requires_person(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    try:
        todos.create_todo(title="Wait for vendor reply", status="pending_on_others", classify_tags=False)
    except ValueError as exc:
        assert "must have a person assigned" in str(exc)
    else:
        raise AssertionError("Expected ValueError when pending todo has no person.")


def test_pending_on_others_tracks_person_and_clears_on_move(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    person = todos.create_person("Aditya")
    todo = todos.create_todo(
        title="Wait for Aditya's numbers",
        status="pending_on_others",
        waiting_on_person_id=person["id"],
        classify_tags=False,
    )

    assert todo["waiting_on_person"]["name"] == "Aditya"

    updated = todos.update_todo(todo["id"], {"status": "wip"})

    assert updated["status"] == "wip"
    assert updated["waiting_on_person"] is None


def test_done_sets_completed_at_and_reopen_clears_it(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    todo = todos.create_todo(title="Close the loop", classify_tags=False)

    done = todos.update_todo(todo["id"], {"status": "done"})
    assert done["completed_at"] is not None

    reopened = todos.update_todo(todo["id"], {"status": "wip"})
    assert reopened["completed_at"] is None


def test_people_are_reused_by_normalized_name(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)

    first = todos.create_person("Aditya")
    second = todos.create_person("  aditya  ")

    assert first["id"] == second["id"]
    assert [person["name"] for person in todos.list_people()] == ["aditya"]


def test_reminder_digest_falls_back_when_llm_unavailable(monkeypatch, tmp_path):
    use_tmp_db(monkeypatch, tmp_path)
    work = todos.create_tag("Work Delegation")
    todos.create_todo(
        title="Follow up with Aditya",
        tag_ids=[work["id"]],
        status="update_needed",
        priority="high",
        due_date="2026-06-13",
    )
    monkeypatch.setattr(todos, "require_env", lambda _name: (_ for _ in ()).throw(RuntimeError("missing")))

    digest = todos.build_reminder_digest()

    assert digest["source"] == "fallback"
    assert "Follow up with Aditya" in digest["message"]
    assert "high" in digest["message"]
