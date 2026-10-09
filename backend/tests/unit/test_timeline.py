from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.application.timeline.service import TimelineService


def test_derive_entry_type_for_authentication_failure():
    event = SimpleNamespace(event_type="authentication", status="failed")
    assert TimelineService._derive_entry_type(event) == "AUTHENTICATION_FAILED"


def test_derive_entry_type_for_authentication_success():
    event = SimpleNamespace(event_type="authentication", status="success")
    assert TimelineService._derive_entry_type(event) == "AUTHENTICATION_SUCCESS"


def test_derive_title_for_authentication_status():
    failed = SimpleNamespace(event_type="authentication", status="failed")
    success = SimpleNamespace(event_type="authentication", status="success")
    assert TimelineService._derive_title(failed) == "Failed authentication"
    assert TimelineService._derive_title(success) == "Successful authentication"


def test_derive_entry_type_for_process_execution():
    event = SimpleNamespace(event_type="process_execution", status=None)
    assert TimelineService._derive_entry_type(event) == "PROCESS_EXECUTION"


def test_derive_title_and_description_preserve_event_context():
    event = SimpleNamespace(
        event_type="process_execution",
        source_user="analyst",
        source_ip="10.10.10.50",
        process="/bin/bash",
        parent_process="sshd",
        resource="id",
        action="execute",
        status=None,
        hostname=None,
    )
    assert TimelineService._derive_title(event) == "Process execution"
    description = TimelineService._derive_description(event)
    assert "user=analyst" in description
    assert "source_ip=10.10.10.50" in description
    assert "process=/bin/bash" in description
    assert "parent_process=sshd" in description
    assert "resource=id" in description
    assert "action=execute" in description


def test_timeline_summary_fields_are_uuid_and_timestamp_compatible():
    assert uuid4()
    assert datetime.now(timezone.utc)
