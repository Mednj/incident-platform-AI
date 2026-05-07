# Architecture Notes

## Goal

Incident Platform AI helps developers move from noisy production logs to a focused incident record. The MVP emphasizes event contracts, traceable incident grouping, and a presentable investigation UI.

## Service Responsibilities

| Service | Responsibility |
| --- | --- |
| `auth-service` | Issues JWTs for demo developer/admin users. |
| `ingestion-service` | Accepts JSON and file-upload logs, validates required fields, and publishes Avro log events. |
| `event-processor-service` | Normalizes logs and computes stable fingerprints for grouping. |
| `incident-service` | Owns incident state, status changes, comments, assignment, and AI request events. |
| `ai-analysis-service` | Generates incident summaries and next steps through a pluggable analysis provider. |
| `notification-service` | Consumes new incident events and logs notifications. |

## Why Schema Registry And Avro

Kafka is the integration point between services, so event shape matters. Avro schemas give each event an explicit contract, and Schema Registry enforces compatibility as the platform evolves. This makes the project easier to reason about and closer to a production event-driven system than ad hoc JSON topics.

## MVP Tradeoffs

- The AI provider defaults to a deterministic local implementation so the demo works without paid API keys.
- Log search is represented in the UI and data model, but full indexing can be added later with OpenSearch or PostgreSQL full-text search.
- Auth uses demo JWT users instead of OIDC to keep the project simple and runnable.
- Kubernetes manifests assume externalized or separately managed Kafka, Schema Registry, and PostgreSQL for production-style deployment.

