# AI Incident & Log Investigation Platform

MVP distributed platform for ingesting logs, processing Kafka events with Avro and Schema Registry, storing incidents in PostgreSQL, and helping developers investigate production issues with AI-assisted analysis.

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

