# Incident Platform AI

MVP distributed platform for ingesting logs, processing Kafka events with Avro and Schema Registry, storing incidents in PostgreSQL, and helping developers investigate production issues with AI-assisted analysis.

This project is designed as a portfolio-ready system: small enough to run locally, but structured like a real production platform with service boundaries, event contracts, database migrations, Docker, and Kubernetes manifests.

## Demo Preview

The first screen is the actual investigation workspace: developers can filter incidents, inspect grouped production failures, review metadata, refresh AI analysis, and follow the incident timeline.

![Incident investigation workspace](docs/assets/ui-workspace.svg)

Kafka UI and Schema Registry are included in the local demo so the event-driven architecture is visible, not just described.

![Kafka UI topics](docs/assets/kafka-ui-topics.svg)

![Schema Registry subjects](docs/assets/schema-registry-subjects.svg)

The full MVP runs locally through Docker Compose with Kafka, Schema Registry, PostgreSQL, backend services, and the Angular frontend.

![Docker Compose stack](docs/assets/docker-stack.svg)

## Stack

- Java 17, Spring Boot 3
- Kafka, Confluent Schema Registry, Avro
- PostgreSQL, Flyway
- Angular
- Docker Compose
- Kubernetes manifests

## Repository Layout

```text
backend/
  pom.xml
  common-events/          Avro schemas and generated Java event classes
  common-security/        Shared JWT helpers and security configuration
  ingestion-service/      REST and file/batch log ingestion
  event-processor-service Kafka log normalization and incident candidate detection
  incident-service/       Incident persistence and workflow APIs
  ai-analysis-service/    Pluggable AI analysis worker and APIs
  notification-service/   Notification event consumer
  auth-service/           JWT login API
frontend/                 Angular investigation workspace
deploy/k8s/               Kubernetes deployment manifests
docker-compose.yml        Local platform runtime
```

## Architecture

```mermaid
flowchart LR
  Developer["Developer"]
  UI["Angular Investigation Workspace"]
  Auth["auth-service"]
  Ingest["ingestion-service"]
  Processor["event-processor-service"]
  Incident["incident-service"]
  AI["ai-analysis-service"]
  Notify["notification-service"]
  Kafka[("Kafka")]
  Registry["Confluent Schema Registry"]
  Postgres[("PostgreSQL")]

  Developer --> UI
  UI --> Auth
  UI --> Ingest
  UI --> Incident
  UI --> AI
  Ingest -->|"LogReceivedEvent Avro"| Kafka
  Kafka --> Processor
  Processor -->|"LogNormalizedEvent Avro"| Kafka
  Processor -->|"IncidentCandidateEvent Avro"| Kafka
  Kafka --> Incident
  Incident --> Postgres
  Incident -->|"IncidentCreatedEvent Avro"| Kafka
  Incident -->|"AIAnalysisRequestedEvent Avro"| Kafka
  Kafka --> AI
  AI --> Postgres
  AI -->|"AIAnalysisCompletedEvent Avro"| Kafka
  Kafka --> Notify
  Ingest -. schema validation .-> Registry
  Processor -. schema validation .-> Registry
  Incident -. schema validation .-> Registry
  AI -. schema validation .-> Registry
```

## Event Flow

```mermaid
sequenceDiagram
  autonumber
  participant UI as Angular UI
  participant ING as ingestion-service
  participant K as Kafka
  participant SR as Schema Registry
  participant EP as event-processor-service
  participant INC as incident-service
  participant DB as PostgreSQL
  participant AI as ai-analysis-service

  UI->>ING: POST /api/logs
  ING->>SR: Validate LogReceivedEvent schema
  ING->>K: Publish logs.received.v1
  K->>EP: Consume LogReceivedEvent
  EP->>K: Publish logs.normalized.v1
  EP->>K: Publish incidents.candidates.v1
  K->>INC: Consume IncidentCandidateEvent
  INC->>DB: Create or update incident by fingerprint
  UI->>INC: Request incident detail
  UI->>AI: Refresh AI analysis
  AI->>DB: Store summary, likely causes, next steps
```

## Data Model

```mermaid
erDiagram
  USERS ||--o{ INCIDENT_COMMENTS : writes
  USERS ||--o{ INCIDENT_ASSIGNMENTS : receives
  SERVICES ||--o{ LOG_ENTRIES : emits
  SERVICES ||--o{ INCIDENTS : affects
  INCIDENTS ||--o{ INCIDENT_EVENTS : records
  INCIDENTS ||--o{ INCIDENT_COMMENTS : contains
  INCIDENTS ||--o{ INCIDENT_ASSIGNMENTS : has
  INCIDENTS ||--o{ AI_ANALYSIS : receives
  INCIDENTS {
    uuid id PK
    string title
    string severity
    string status
    string affected_service
    string environment
    string fingerprint
    int event_count
  }
  LOG_ENTRIES {
    uuid id PK
    string service
    string severity
    string trace_id
    string fingerprint
  }
  AI_ANALYSIS {
    uuid id PK
    uuid incident_id FK
    string summary
    decimal confidence
    string model_name
  }
```

## Local Development

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start infrastructure and services:

```powershell
docker compose up --build
```

3. Open the frontend at `http://localhost:4200`.
4. Login with the seeded demo user:

```text
email: dev@example.com
password: password
```

5. Click **Send demo error log** in the UI. The log moves through Kafka, becomes an incident candidate, is stored as an incident, and can then receive AI analysis.

Useful local URLs:

| Tool | URL | Purpose |
| --- | --- | --- |
| Angular UI | `http://localhost:4200` | Investigation dashboard |
| Kafka UI | `http://localhost:8090` | Topic/message inspection |
| Schema Registry | `http://localhost:8088/subjects` | Registered Avro subjects |
| Auth API | `http://localhost:8086` | JWT login |
| Ingestion API | `http://localhost:8081` | Log ingestion |
| Incident API | `http://localhost:8083` | Incident workflow |
| AI Analysis API | `http://localhost:8084` | AI analysis refresh |

## Kafka Topics

| Topic | Avro event |
| --- | --- |
| `logs.received.v1` | `LogReceivedEvent` |
| `logs.normalized.v1` | `LogNormalizedEvent` |
| `incidents.candidates.v1` | `IncidentCandidateEvent` |
| `incidents.created.v1` | `IncidentCreatedEvent` |
| `ai.analysis.requested.v1` | `AIAnalysisRequestedEvent` |
| `ai.analysis.completed.v1` | `AIAnalysisCompletedEvent` |

## Core Flow

1. `ingestion-service` receives JSON log payloads and publishes `LogReceivedEvent`.
2. `event-processor-service` normalizes logs, fingerprints failures, and publishes incident candidates.
3. `incident-service` creates or updates incidents by fingerprint.
4. Developers inspect incidents in Angular and request AI analysis.
5. `ai-analysis-service` generates a deterministic local summary by default, or calls a configured provider adapter.
6. `notification-service` records/logs new incident notifications.

## Demo Script

Use this short flow for a portfolio walkthrough:

1. Open the Angular dashboard and show the seeded production incident.
2. Click **Send demo error log** to create a fresh failure.
3. Open Kafka UI and show messages appearing on `logs.received.v1`, `logs.normalized.v1`, and `incidents.candidates.v1`.
4. Open Schema Registry and show the Avro subjects registered for each event contract.
5. Return to the incident detail page and refresh AI analysis.
6. Show Docker Desktop or `docker compose ps` to prove the system is running as distributed services.

## API Quick Start

Login:

```powershell
curl -X POST http://localhost:8086/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"dev@example.com\",\"password\":\"password\"}"
```

Ingest a log:

```powershell
curl -X POST http://localhost:8081/api/logs `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <token>" `
  -d "{\"application\":\"checkout-api\",\"environment\":\"prod\",\"severity\":\"ERROR\",\"message\":\"PaymentProviderTimeoutException order 42 failed\"}"
```

List incidents:

```powershell
curl http://localhost:8083/api/incidents -H "Authorization: Bearer <token>"
```

## What To Highlight In A Portfolio Walkthrough

- Distributed service design with clear ownership per service.
- Kafka event choreography using Avro contracts and Schema Registry.
- Deterministic incident grouping through normalized fingerprints.
- PostgreSQL migrations and seeded demo data.
- AI analysis isolated behind a provider interface, with a local deterministic provider for demos.
- Angular dashboard focused on the developer investigation workflow.
- Docker Compose for local demo and Kubernetes manifests for deployment readiness.

## Verification

When Maven is available:

```powershell
cd backend
mvn test
```

When Node dependencies are installed:

```powershell
cd frontend
npm install
npm test
npm run build
```
