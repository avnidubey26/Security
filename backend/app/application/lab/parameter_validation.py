from ipaddress import ip_address
from typing import Any


class InvalidScenarioParameters(ValueError):
    pass


RUNNER_FIELDS: dict[str, set[str]] = {
    "auth_bruteforce_command": {"username", "source_ip"},
    "suspicious_process_chain": {"username", "source_ip", "hostname"},
    "network_port_sweep": {"source_ip", "destination_ip", "ports"},
}


def validate_parameters(runner_key: str, parameters: dict[str, Any]) -> dict[str, Any]:
    allowed = RUNNER_FIELDS.get(runner_key)
    if allowed is None:
        raise InvalidScenarioParameters("Scenario runner is not allowlisted")

    unknown = sorted(set(parameters) - allowed)
    if unknown:
        raise InvalidScenarioParameters(f"Unsupported scenario parameters: {', '.join(unknown)}")

    result = dict(parameters)
    if "username" in result:
        username = result["username"]
        if not isinstance(username, str) or not 1 <= len(username) <= 150:
            raise InvalidScenarioParameters("username must be a non-empty string of at most 150 characters")
    if "hostname" in result:
        hostname = result["hostname"]
        if not isinstance(hostname, str) or not 1 <= len(hostname) <= 255:
            raise InvalidScenarioParameters("hostname must be a non-empty string of at most 255 characters")
    for field in ("source_ip", "destination_ip"):
        if field in result:
            value = result[field]
            if not isinstance(value, str):
                raise InvalidScenarioParameters(f"{field} must be an IP address string")
            try:
                ip_address(value)
            except ValueError as exc:
                raise InvalidScenarioParameters(f"{field} must be a valid IP address") from exc
    if "ports" in result:
        ports = result["ports"]
        if not isinstance(ports, list) or not 1 <= len(ports) <= 10:
            raise InvalidScenarioParameters("ports must contain between 1 and 10 values")
        if any(type(port) is not int or not 1 <= port <= 65535 for port in ports):
            raise InvalidScenarioParameters("ports must contain integers between 1 and 65535")
    return result
