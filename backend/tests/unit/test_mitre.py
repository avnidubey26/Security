from app.domain.mitre.models import technique_ids_for_scenario


def test_scenario_mapping_uses_evidence_supported_techniques():
    assert technique_ids_for_scenario() == ("T1110.001", "T1087.001")
