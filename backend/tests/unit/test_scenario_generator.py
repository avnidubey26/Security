from app.application.scenarios.generator import BruteForceScenarioGenerator

def test_bruteforce_scenario_generates_expected_sequence():
    events = BruteForceScenarioGenerator().generate()
    assert len(events) == 7
    assert [event.event_type for event in events] == ["authentication"] * 6 + ["process_execution"]
    assert all(event.payload["status"] == "failed" for event in events[:5])
    assert events[5].payload["status"] == "success"
    assert events[6].payload["process"] == "/bin/bash"
