process.env["DATABASE_URL"] = "postgres://localhost:5432/test";
process.env["REDIS_URL"] = "redis://localhost:6379/0";
process.env["JWT_SECRET"] = "rag-jwt-secret-demo-for-testing-purposes-32-chars";
process.env["JWT_ISSUER"] = "rag-kb-issuer";
process.env["JWT_AUDIENCE"] = "rag-kb-audience";
process.env["NODE_ENV"] = "test";
