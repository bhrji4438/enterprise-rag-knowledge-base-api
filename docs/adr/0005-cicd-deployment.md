# ADR 0005: CI/CD and Deployment Strategy

## Status

Accepted

## Context

The repository must demonstrate production readiness and DevOps fluency.

## Decision

Use GitHub Actions for dependency installation, lint, tests, TypeScript build, and Docker image verification. Keep image publishing and ArgoCD deployment as the production path once registry credentials and cluster access are configured.

## Consequences

The pipeline is portable and recruiter-friendly. It validates the repository without requiring secrets on public forks, while leaving a clear GitOps path for production promotion.
