from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class MitreTechniqueSummary:
    technique_id: str
    name: str
    tactic_id: str
    tactic_name: str
    parent_technique_id: str | None


MITRE_SEED = (
    {
        "id": "T1110",
        "name": "Brute Force",
        "tactic_id": "TA0006",
        "tactic_name": "Credential Access",
        "description": "Adversaries may use brute force techniques to gain access to accounts.",
        "parent_id": None,
        "platforms": ["Linux", "Windows", "macOS", "Network Devices", "SaaS"],
    },
    {
        "id": "T1110.001",
        "name": "Password Guessing",
        "tactic_id": "TA0006",
        "tactic_name": "Credential Access",
        "description": "Adversaries may guess passwords to attempt access to accounts.",
        "parent_id": "T1110",
        "platforms": ["Linux", "Windows", "macOS", "Network Devices", "SaaS"],
    },
    {
        "id": "T1087",
        "name": "Account Discovery",
        "tactic_id": "TA0007",
        "tactic_name": "Discovery",
        "description": "Adversaries may attempt to get a listing of valid accounts, usernames, or email addresses.",
        "parent_id": None,
        "platforms": ["Linux", "Windows", "macOS", "ESXi", "IaaS", "SaaS"],
    },
    {
        "id": "T1087.001",
        "name": "Local Account",
        "tactic_id": "TA0007",
        "tactic_name": "Discovery",
        "description": "Adversaries may attempt to get a listing of local system accounts.",
        "parent_id": "T1087",
        "platforms": ["Linux", "Windows", "macOS", "ESXi"],
    },
)


def technique_ids_for_scenario() -> tuple[str, ...]:
    return ("T1110.001", "T1087.001")
