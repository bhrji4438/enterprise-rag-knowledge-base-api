# ADR 0005: CI/CD and Deployment Strategy

## Status

Accepted

## Context

The repository must demonstrate production readiness and DevOps fluency.

## Decision

Use GitHub Actions for lint, test, coverage, build, and image publish. Deploy through ArgoCD using Kubernetes manifests and environment-specific configuration.

## Consequences

The pipeline is portable and recruiter-friendly. ArgoCD introduces GitOps concepts but matches enterprise deployment standards.
