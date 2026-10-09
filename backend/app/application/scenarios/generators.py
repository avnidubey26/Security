from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from typing import Protocol

from app.domain.scenarios.models import GeneratedTelemetry


class ScenarioGenerator(Protocol):
    slug: str

    def generate(self, **parameters: object) -> list[GeneratedTelemetry]: ...


class AuthBruteForceCommandGenerator:
    slug = "auth-bruteforce-command-execution"

    def generate(self, *, username: str = "analyst", source_ip: str = "10.10.10.50", **_: object) -> list[GeneratedTelemetry]:
        ip_address(source_ip)
        base = datetime.now(timezone.utc).replace(microsecond=0)
        telemetry: list[GeneratedTelemetry] = []
        for offset in range(5):
            occurred = base + timedelta(seconds=offset * 2)
            telemetry.append(
                GeneratedTelemetry(
                    "authentication",
                    {
                        "timestamp": occurred.isoformat(),
                        "user": username,
                        "source_ip": source_ip,
                        "destination_ip": "10.10.10.10",
                        "destination_port": 22,
                        "action": "login",
                        "status": "failed",
                        "hostname": "lab-host",
                        "resource": "ssh",
                        "metadata": {"scenario": self.slug, "attempt": offset + 1},
                    },
                    occurred,
                )
            )
        occurred = base + timedelta(seconds=12)
        telemetry.append(
            GeneratedTelemetry(
                "authentication",
                {
                    "timestamp": occurred.isoformat(), "user": username, "source_ip": source_ip,
                    "destination_ip": "10.10.10.10", "destination_port": 22, "action": "login",
                    "status": "success", "hostname": "lab-host", "resource": "ssh",
                    "metadata": {"scenario": self.slug},
                },
                occurred,
            )
        )
        occurred = base + timedelta(seconds=15)
        telemetry.append(
            GeneratedTelemetry(
                "process_execution",
                {
                    "timestamp": occurred.isoformat(), "user": username, "source_ip": source_ip,
                    "hostname": "lab-host", "process": "/bin/bash", "parent_process": "sshd",
                    "action": "execute", "status": "started", "resource": "id",
                    "metadata": {"scenario": self.slug, "command_family": "identity_discovery"},
                },
                occurred,
            )
        )
        return telemetry


class SuspiciousProcessChainGenerator:
    slug = "suspicious-process-chain"

    def generate(self, *, username: str = "analyst", source_ip: str = "10.10.10.50", hostname: str = "lab-host", **_: object) -> list[GeneratedTelemetry]:
        ip_address(source_ip)
        base = datetime.now(timezone.utc).replace(microsecond=0)
        chain = [
            ("/bin/bash", "sshd", "execute", "started", "shell", 0),
            ("/usr/bin/curl", "/bin/bash", "execute", "started", "network_utility", 2),
            ("/bin/cat", "/bin/bash", "execute", "started", "file_read", 4),
        ]
        return [
            GeneratedTelemetry(
                "process_execution",
                {
                    "timestamp": (base + timedelta(seconds=offset)).isoformat(),
                    "user": username,
                    "source_ip": source_ip,
                    "hostname": hostname,
                    "process": process,
                    "parent_process": parent,
                    "action": action,
                    "status": status,
                    "resource": process,
                    "metadata": {"scenario": self.slug, "simulation": True, "command_family": family},
                },
                base + timedelta(seconds=offset),
            )
            for process, parent, action, status, family, offset in chain
        ]


class NetworkPortSweepGenerator:
    slug = "network-port-sweep"

    def generate(
        self,
        *,
        source_ip: str = "10.10.10.50",
        destination_ip: str = "10.10.10.10",
        ports: list[int] | None = None,
        **_: object,
    ) -> list[GeneratedTelemetry]:
        ip_address(source_ip)
        ip_address(destination_ip)
        selected_ports = ports or [22, 80, 443]
        if not 1 <= len(selected_ports) <= 10:
            raise ValueError("ports must contain between 1 and 10 values")
        if any(not isinstance(port, int) or not 1 <= port <= 65535 for port in selected_ports):
            raise ValueError("ports must contain valid TCP port numbers")
        base = datetime.now(timezone.utc).replace(microsecond=0)
        return [
            GeneratedTelemetry(
                "network_connection",
                {
                    "timestamp": (base + timedelta(milliseconds=index * 250)).isoformat(),
                    "source_ip": source_ip,
                    "destination_ip": destination_ip,
                    "destination_port": port,
                    "action": "connect",
                    "status": "blocked",
                    "hostname": "lab-target",
                    "resource": f"tcp/{port}",
                    "metadata": {"scenario": self.slug, "simulation": True, "sweep_index": index + 1},
                },
                base + timedelta(milliseconds=index * 250),
            )
            for index, port in enumerate(selected_ports)
        ]


SCENARIO_GENERATORS: dict[str, ScenarioGenerator] = {
    "auth_bruteforce_command": AuthBruteForceCommandGenerator(),
    "suspicious_process_chain": SuspiciousProcessChainGenerator(),
    "network_port_sweep": NetworkPortSweepGenerator(),
}
