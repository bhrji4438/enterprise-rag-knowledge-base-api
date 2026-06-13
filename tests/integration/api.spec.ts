import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { setDependencies } from "../../src/composition-root.js";
import { ProblemDetailsError } from "../../src/shared/errors/problem-details.js";

// Helper to generate a test token
function generateToken(
  tenantId: string,
  email: string,
  role: string,
  secret = "rag-jwt-secret-demo-for-testing-purposes-32-chars"
) {
  return jwt.sign({ tenantId, email, role }, secret, {
    issuer: "rag-kb-issuer",
    audience: "rag-kb-audience",
    expiresIn: "1h",
  });
}

export async function runIntegrationTests(): Promise<void> {
  const jwtSecret = "rag-jwt-secret-demo-for-testing-purposes-32-chars";

  // Set test environment configuration
  process.env["NODE_ENV"] = "test";
  process.env["JWT_SECRET"] = jwtSecret;
  process.env["JWT_ISSUER"] = "rag-kb-issuer";
  process.env["JWT_AUDIENCE"] = "rag-kb-audience";
  process.env["DATABASE_URL"] = "postgres://localhost:5432/test";
  process.env["REDIS_URL"] = "redis://localhost:6379/0";

  // Mocks
  const mockDb = {
    execute: async () => [{ "?column?": 1 }],
  };

  const mockRedis = {
    get: async (key: string) => {
      if (key.includes("budget-exceeded-tenant")) {
        return "999999999"; // Exceeds budget
      }
      return "0";
    },
    ping: async () => "PONG",
    incrby: async () => 1,
    expire: async () => 1,
    call: async () => 1,
  };

  // Mock repo state
  const uploadedDocs = new Map<string, any>();
  const mockDocRepo = {
    create: async (doc: any) => {
      // Simulate unique index constraint on tenantId + checksum
      for (const existing of uploadedDocs.values()) {
        if (existing.tenantId === doc.tenantId && existing.checksumSha256 === doc.checksumSha256) {
          throw new Error("uq_documents_tenant_checksum");
        }
      }
      uploadedDocs.set(doc.id, doc);
      return doc;
    },
    findById: async (tenantId: string, id: string) => {
      const doc = uploadedDocs.get(id);
      if (doc && doc.tenantId === tenantId) {
        return doc;
      }
      return null;
    },
    markProcessing: async () => {},
    markIndexed: async () => {},
    saveChunks: async () => {},
  };

  const mockVectorRepo = {};

  const mockQueue = {
    add: async () => ({ id: "job-1" }),
  };

  const mockWorker = {
    on: () => {},
  };

  const mockAnswerService = {
    answer: async (input: { tenantId: string; question: string }) => {
      // If tenant budget exceeded
      if (input.tenantId === "budget-exceeded-tenant") {
        throw new ProblemDetailsError({
          status: 402,
          title: "Token budget exceeded",
          type: "https://ragkb.dev/problems/budget-exceeded",
          detail: "Token budget exceeded",
        });
      }
      return {
        answer: `Answer for ${input.question}`,
        citations: [{ chunkId: "chunk-1", documentId: "doc-1", score: 0.95 }],
      };
    },
  };

  const mockPipeline = {
    run: async () => {},
  };

  setDependencies({
    db: mockDb,
    redis: mockRedis as any,
    documentRepository: mockDocRepo as any,
    vectorRepository: mockVectorRepo as any,
    answerService: mockAnswerService as any,
    ingestionPipeline: mockPipeline as any,
    ingestionQueue: mockQueue as any,
    ingestionWorker: mockWorker as any,
  });

  // Now dynamically load the app
  const { appPromise } = await import("../../src/index.js");
  const app = await appPromise;

  // Let's run individual integration scenarios!

  // ── Scenario 1: RBAC enforcement ──
  // A viewer should NOT be allowed to upload documents
  {
    const viewerToken = generateToken("tenant-1", "viewer@test.com", "viewer", jwtSecret);
    const res = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${viewerToken}`)
      .attach("file", Buffer.from("Hello world"), "test.txt");

    assert.equal(res.status, 403, "Viewer role should get 403 Forbidden on upload");
    assert.equal(res.body.type, "https://ragkb.dev/problems/forbidden");
  }

  // An admin should be allowed to upload documents
  let uploadedDocId = "";
  {
    const adminToken = generateToken("tenant-1", "admin@test.com", "admin", jwtSecret);
    const res = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("Hello world from unit test"), "test.txt");

    assert.equal(res.status, 202, "Admin should get 202 Accepted on upload");
    assert.ok(res.body.documentId, "Response should contain documentId");
    uploadedDocId = res.body.documentId;
  }

  // ── Scenario 2: Duplicate checksum is rejected with 409 ──
  {
    const adminToken = generateToken("tenant-1", "admin@test.com", "admin", jwtSecret);
    const res = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("Hello world from unit test"), "test.txt"); // identical content

    assert.equal(res.status, 409, "Duplicate upload should return 409 Conflict");
    assert.equal(res.body.type, "https://ragkb.dev/problems/conflict");
  }

  // ── Scenario 3: Tenant Isolation ──
  // Tenant B cannot read Tenant A's documents
  {
    const tenantBToken = generateToken("tenant-2", "user@test.com", "viewer", jwtSecret);
    const res = await request(app)
      .get(`/v1/documents/${uploadedDocId}`)
      .set("Authorization", `Bearer ${tenantBToken}`);

    assert.equal(res.status, 404, "Tenant B should get 404 Not Found for Tenant A's document");
  }

  // Tenant A CAN read their own document
  {
    const tenantAToken = generateToken("tenant-1", "user@test.com", "viewer", jwtSecret);
    const res = await request(app)
      .get(`/v1/documents/${uploadedDocId}`)
      .set("Authorization", `Bearer ${tenantAToken}`);

    assert.equal(res.status, 200, "Tenant A should get 200 OK for their own document");
    assert.equal(res.body.id, uploadedDocId);
  }

  // ── Scenario 4: Budget Exceeded returns 402 ──
  {
    const budgetExceededToken = generateToken("budget-exceeded-tenant", "user@test.com", "viewer", jwtSecret);
    const res = await request(app)
      .post("/v1/query")
      .set("Authorization", `Bearer ${budgetExceededToken}`)
      .send({ question: "Tell me something", topK: 3 });

    assert.equal(res.status, 402, "Querying with exceeded budget should return 402");
    assert.equal(res.body.type, "https://ragkb.dev/problems/budget-exceeded");
  }

  // ── Scenario 5: Successful Query returns answers and citations ──
  {
    const okToken = generateToken("tenant-1", "user@test.com", "viewer", jwtSecret);
    const res = await request(app)
      .post("/v1/query")
      .set("Authorization", `Bearer ${okToken}`)
      .send({ question: "What is the policy?", topK: 3 });

    assert.equal(res.status, 200, "Successful query should return 200 OK");
    assert.equal(res.body.answer, "Answer for What is the policy?");
    assert.ok(res.body.citations.length > 0, "Response should include citations");
  }
}
