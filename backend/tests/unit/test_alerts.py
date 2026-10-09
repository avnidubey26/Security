from uuid import uuid4


def test_alert_statuses_are_stable():
    from app.domain.alerts.models import ALERT_STATUSES

    assert ALERT_STATUSES == {"NEW", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"}


def test_alert_event_ids_are_uuid_compatible():
    from uuid import UUID

    event_id = uuid4()
    assert UUID(str(event_id)) == event_id
