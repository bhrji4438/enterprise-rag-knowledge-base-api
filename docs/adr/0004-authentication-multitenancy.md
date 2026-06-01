# ADR 0004: Authentication and Multi-Tenancy

## Status

Accepted

## Context

The API handles private knowledge bases for multiple tenants. Tenant leakage would be a critical security failure.

## Decision

Use JWT authentication with tenant and role claims. Enforce tenant scoping in controllers, services, and repository contracts. Use RBAC for document, query, admin, and usage permissions.

## Consequences

Every query includes tenant context, which adds implementation discipline. The result is safer and directly relevant to SaaS roles.
