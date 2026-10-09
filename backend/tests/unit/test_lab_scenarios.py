from app.application.lab.parameter_validation import InvalidScenarioParameters, validate_parameters
from app.application.scenarios.generators import (
    AuthBruteForceCommandGenerator,
    NetworkPortSweepGenerator,
    SuspiciousProcessChainGenerator,
)


def test_auth_generator_remains_compatible_with_phase_7_shape():
    events = AuthBruteForceCommandGenerator().generate(username="analyst", source_ip="10.10.10.50")
    assert len(events) == 7
    assert [event.payload["status"] for event in events[:5]] == ["failed"] * 5
    assert events[5].payload["status"] == "success"
    assert events[6].payload["resource"] == "id"


def test_suspicious_process_chain_is_synthetic_only():
    events = SuspiciousProcessChainGenerator().generate()
    assert len(events) == 3
    assert all(event.payload["metadata"]["simulation"] is True for event in events)
    assert events[1].payload["process"] == "/usr/bin/curl"


def test_network_sweep_is_bounded():
    events = NetworkPortSweepGenerator().generate(ports=[22, 80, 443])
    assert len(events) == 3
    assert [event.payload["destination_port"] for event in events] == [22, 80, 443]
    assert all(event.payload["status"] == "blocked" for event in events)


def test_unknown_lab_parameter_is_rejected():
    try:
        validate_parameters("network_port_sweep", {"command": "nmap"})
    except InvalidScenarioParameters as exc:
        assert "Unsupported scenario parameters" in str(exc)
    else:
        raise AssertionError("unknown parameters must be rejected")


def test_port_list_is_bounded():
    try:
        validate_parameters("network_port_sweep", {"ports": list(range(1, 12))})
    except InvalidScenarioParameters as exc:
        assert "between 1 and 10" in str(exc)
    else:
        raise AssertionError("port lists above the bound must be rejected")
