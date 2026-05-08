# Kubernetes Manifests

This directory contains Kubernetes-ready manifests for the incident platform MVP.

They are intended as deployment-readiness assets for a portfolio project and local cluster experimentation. The Docker Compose setup is the primary verified local runtime. For production, Kafka, Schema Registry, and PostgreSQL should normally be replaced with managed services or operator-backed deployments.

## Included Resources

| File | Purpose |
| --- | --- |
| `namespace.yaml` | Creates the `incident-platform` namespace |
| `configmap.yaml` | Non-secret service configuration |
| `secret.example.yaml` | Example secrets for local/dev clusters |
| `postgres.yaml` | Dev PostgreSQL deployment and service |
| `kafka-dev.yaml` | Dev Zookeeper, Kafka, and Schema Registry deployments |
| `services.yaml` | Spring Boot service and frontend deployments/services |
| `ingress.yaml` | Ingress routes for frontend and public APIs |
| `hpa.yaml` | Horizontal pod autoscalers for stateless services |
| `kustomization.yaml` | Applies the manifest set together |

## Apply To A Local Cluster

Build and publish the service images referenced in `services.yaml`, or edit the image names to match your local registry.

```powershell
kubectl apply -k deploy/k8s
```

Check rollout status:

```powershell
kubectl -n incident-platform get pods
kubectl -n incident-platform get svc
```

For local ingress testing, map the hostname to your cluster ingress address:

```text
incident-platform.local
```

## Production Notes

- Replace `secret.example.yaml` with real Kubernetes secrets.
- Use managed PostgreSQL or a StatefulSet/operator-backed database.
- Use managed Kafka/Schema Registry or a Kafka operator such as Strimzi/Confluent Operator.
- Pin image tags instead of using `latest`.
- Add TLS configuration to the ingress.
- Tune resource requests/limits using observed traffic and workload metrics.
