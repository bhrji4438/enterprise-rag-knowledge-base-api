# I. DevOps & Deployment Spec

## 1. Dockerfile

See `docker/Dockerfile`. It uses dependency install, TypeScript build, and a slim production runtime with non-root user.

## 2. Docker Compose

See `docker-compose.yml`. It runs app, PostgreSQL with pgvector, and Redis.

## 3. Kubernetes Manifests

`k8s/deployment.yaml` defines replicas, probes, resource limits, and config injection. `k8s/service.yaml` exposes the app internally. `k8s/hpa.yaml` scales on CPU and memory; queue-depth scaling can be added with KEDA.

## 4. CI/CD Pipeline

GitHub Actions runs lint, tests, coverage, build, image publish, and ArgoCD sync. Production deploys require protected environment approval.

## 5. Promotion Strategy

Dev auto-deploys from feature branches to ephemeral namespaces. Staging deploys from `main` after CI. Production deploys from signed tags after approval, smoke tests, and migration checks.

## 6. Health Checks

Liveness: `/health/live` checks process health. Readiness: `/health/ready` checks database, Redis, queue connectivity, and migration compatibility.

## 7. Rollback Procedure

Use ArgoCD rollback to the previous healthy image tag. Database migrations must be backward compatible; destructive migrations are split into expand-migrate-contract releases.
