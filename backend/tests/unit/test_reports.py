from datetime import datetime, timezone
from uuid import uuid4

from app.domain.reports.models import ReportDocument


def test_report_document_contains_expected_sections() -> None:
    report = ReportDocument(
        investigation={"id": uuid4(), "title": "Investigation"},
        incident=None,
        detections=[],
        alerts=[],
        events=[],
        timeline=[],
        findings=[],
        notes=[],
        evidence=[],
        mitre_techniques=[],
        generated_at=datetime.now(timezone.utc),
    )

    assert report.investigation["title"] == "Investigation"
    assert report.incident is None
    assert report.detections == []
    assert report.alerts == []
    assert report.events == []
    assert report.timeline == []
    assert report.findings == []
    assert report.notes == []
    assert report.evidence == []
    assert report.mitre_techniques == []
