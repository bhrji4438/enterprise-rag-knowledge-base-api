import { db } from "../src/infrastructure/db/connection.js";
import { documents, documentChunks } from "../src/infrastructure/db/schema.js";

function generateMockVector(dimensions = 3072): number[] {
  const vec = Array.from({ length: dimensions }, () => Math.random() - 0.5);
  const len = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((v) => v / (len || 1));
}

async function run() {
  console.log("Seeding database...");

  try {
    // 1. Clean existing tables
    console.log("Cleaning database tables...");
    await db.delete(documentChunks);
    await db.delete(documents);

    // 2. Insert sample document
    console.log("Inserting sample document...");
    const sampleDoc = {
      id: "doc-1",
      tenantId: "tenant-1",
      title: "Enterprise Security Guidelines",
      sourceUri: "https://internal.corp/security-guidelines.txt",
      mimeType: "text/plain",
      status: "indexed",
      checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      createdBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.insert(documents).values(sampleDoc);

    // 3. Insert sample chunks
    console.log("Inserting sample chunks...");
    const sampleChunks = [
      {
        id: "chunk-1",
        tenantId: "tenant-1",
        documentId: "doc-1",
        ordinal: 1,
        content: "Password policy: All employees must use passwords that are at least 16 characters long. Passwords must contain uppercase, lowercase, numbers, and special characters.",
        tokenCount: 25,
        metadata: { category: "passwords", section: "1.1" },
        embedding: generateMockVector()
      },
      {
        id: "chunk-2",
        tenantId: "tenant-1",
        documentId: "doc-1",
        ordinal: 2,
        content: "Access Control: Multi-factor authentication (MFA) is mandatory for all internal services, including email, source control, and database access.",
        tokenCount: 23,
        metadata: { category: "mfa", section: "1.2" },
        embedding: generateMockVector()
      },
      {
        id: "chunk-3",
        tenantId: "tenant-1",
        documentId: "doc-1",
        ordinal: 3,
        content: "Remote Work Policy: When connecting from outside the office, employees must use the corporate VPN. Direct connections to production servers are strictly prohibited.",
        tokenCount: 25,
        metadata: { category: "vpn", section: "2.1" },
        embedding: generateMockVector()
      }
    ];

    await db.insert(documentChunks).values(sampleChunks);

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

run();
