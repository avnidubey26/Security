# Security — Defensive Cybersecurity Investigation Platform

A security investigation platform designed to simulate security scenarios, process telemetry, detect suspicious activity, manage alerts, and support structured incident investigations.

Security brings key stages of a defensive security workflow into one interface, from event analysis and detection to evidence collection and incident reporting.

## Overview

Security is a defensive cybersecurity project focused on security monitoring, detection engineering, and investigation workflows. It provides a structured environment for exploring how security events can be normalized, evaluated against detection rules, converted into alerts, and investigated.

The platform is intended for cybersecurity learning, detection engineering practice, and portfolio demonstration.

## Key Features

- **Security Scenarios:** Generate and manage controlled security scenarios for testing detection workflows.
- **Telemetry Processing:** Normalize security events into a consistent structure for analysis.
- **Detection Engine:** Evaluate telemetry against configurable detection logic and thresholds.
- **Alert Management:** Review and manage alerts produced by detection rules.
- **Investigations:** Organize investigation records and track investigation status.
- **Attack Timeline:** Review related activity through a structured timeline.
- **MITRE ATT&CK Mapping:** Explore mappings between supported detections and MITRE ATT&CK techniques.
- **Evidence Management:** Organize evidence associated with investigations and incidents.
- **Incident Management:** Track incidents through a structured workflow.
- **Reports:** Generate investigation and incident reports.
- **REST API:** Access backend capabilities through FastAPI endpoints.
- **Web Dashboard:** Interact with security workflows through a Next.js frontend.

## Architecture

The platform follows a layered architecture that separates API routes, application services, domain models, and infrastructure components.

```text
Security Platform
│
├── Frontend
│   └── Next.js · React · TypeScript
│
├── Backend
│   └── FastAPI · Python
│       ├── API Routes
│       ├── Application Services
│       ├── Detection Engine
│       ├── Investigation Workflows
│       └── Reporting Services
│
├── Database
│   └── PostgreSQL
│
└── Infrastructure
    ├── Docker
    ├── Docker Compose
    └── Alembic Migrations
```

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database Migrations | Alembic |
| Testing | Pytest |
| Containerization | Docker, Docker Compose |
| Security Framework | MITRE ATT&CK mapping |

## Project Workflow

```text
Security Scenario
       ↓
Telemetry Generation
       ↓
Event Normalization
       ↓
Detection Engine
       ↓
Alert Management
       ↓
Investigation & Timeline
       ↓
Evidence & Incident Management
       ↓
Reporting
```

## Getting Started

### Prerequisites

Install the following tools before running the project:

- Git
- Docker Desktop with Docker Compose
- Node.js and npm

### 1. Clone the Repository

```bash
git clone https://github.com/avnidubey26/Security.git
cd Security
```

### 2. Configure Environment Variables

Create your local environment file using the example:

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

Update `.env` with a local development password. Ensure that the PostgreSQL credentials in `DATABASE_URL` match the database configuration.

Do not commit `.env` or real credentials to GitHub.

### 3. Start the Services

```bash
docker compose up --build -d
```

Check service status:

```bash
docker compose ps
```

### 4. Access the Application

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`

These addresses assume the default local development port configuration.

### 5. Run Backend Tests

```bash
docker compose exec backend pytest -q
```

Run the tests after the backend services and database have started successfully.

## Repository Structure

```text
Security/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── application/
│   │   ├── core/
│   │   ├── domain/
│   │   └── infrastructure/
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Testing and Quality

The project includes backend unit and integration tests covering areas such as detection logic, alerts, telemetry normalization, investigations, evidence, incidents, reporting, and scenario workflows.

Frontend quality checks include TypeScript type checking and a production build.

## Security and Scope

- Intended for defensive cybersecurity learning and controlled testing.
- Use only authorized environments and data.
- Keep secrets, credentials, and sensitive investigation data out of public repositories.
- This project is not a replacement for a production SIEM, EDR, or security operations platform.
- Detection coverage and investigation capabilities depend on the implemented rules and integrations.

## Current Status

The repository contains a working implementation of the core security investigation workflow, backend APIs, frontend pages, database migrations, and automated backend tests.

This is an actively developed portfolio project. Features and integrations may evolve.

## Author

**Avni Dubey**

- GitHub: [avnidubey26](https://github.com/avnidubey26)
- LinkedIn: [Avni Dubey](https://www.linkedin.com/in/avni-dubey-922b45285)
- Portfolio: [View Portfolio](https://avnidubey26.github.io/portfolio/)

---

Built to explore defensive security engineering, detection workflows, and incident investigation.
