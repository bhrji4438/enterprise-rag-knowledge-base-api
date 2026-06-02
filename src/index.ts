import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import pinoHttpModule from "pino-http";
import path from "node:path";
import fs from "node:fs";
import jwt from "jsonwebtoken";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = express();
const pinoHttp = pinoHttpModule as unknown as () => express.RequestHandler;
const JWT_SECRET = "rag-jwt-secret-demo";

// Relax CSP for Swagger assets hosted on unpkg CDN
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        "img-src": ["'self'", "data:", "https://unpkg.com"],
      },
    },
  })
);

app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(pinoHttp());

// Authentication Middleware
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      type: "https://ragkb.dev/problems/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Missing or invalid authorization header. Please obtain a JWT from POST /v1/auth/token first."
    });
  }

  const token = authHeader.split(" ")[1] ?? "";
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { tenantId: string; role: string; email: string };
    res.locals.tenantId = decoded.tenantId;
    res.locals.role = decoded.role;
    res.locals.email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({
      type: "https://ragkb.dev/problems/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid or expired JWT token."
    });
  }
}

// Serve OpenAPI Spec
app.get("/openapi.yaml", (_req, res) => {
  const yamlPath = path.join(process.cwd(), "docs", "openapi.yaml");
  if (fs.existsSync(yamlPath)) {
    res.setHeader("Content-Type", "text/yaml");
    res.sendFile(yamlPath);
  } else {
    res.status(404).send("openapi.yaml not found");
  }
});

// Serve Swagger UI
app.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RAG Knowledge Base API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        responseInterceptor: (response) => {
          // If the auth token was successfully retrieved, auto-preauthorize Swagger UI
          if (response.url.endsWith('/v1/auth/token') && response.status === 200) {
            const token = response.body.token;
            if (token) {
              ui.preauthorizeApiKey("bearerAuth", token);
              console.log("Automatically authorized Swagger UI with new JWT token.");
            }
          }
          return response;
        }
      });
    };
  </script>
</body>
</html>
  `);
});

// Issue JWT Token Route
app.post("/v1/auth/token", (req, res) => {
  const { tenantId, email, role } = req.body;
  if (!tenantId || !email || !role) {
    return res.status(400).json({
      type: "https://ragkb.dev/problems/validation-error",
      title: "Validation failed",
      status: 400,
      detail: "tenantId, email, and role are required fields."
    });
  }

  const token = jwt.sign({ tenantId, email, role }, JWT_SECRET, { expiresIn: "1h" });
  res.status(200).json({ token });
});

// Upload Document Route
app.post("/v1/documents", authenticate, (_req, res) => {
  res.status(202).json({
    documentId: `doc-${Math.random().toString(36).substring(2, 11)}`,
    status: "uploaded",
    tenantId: res.locals.tenantId,
    uploadedBy: res.locals.email
  });
});

// List Documents Route
app.get("/v1/documents", authenticate, (_req, res) => {
  res.status(200).json([
    {
      id: "doc-uuid-1234",
      tenantId: res.locals.tenantId,
      title: "refund-policy.pdf",
      status: "indexed",
      mimeType: "application/pdf",
      createdAt: new Date().toISOString()
    },
    {
      id: "doc-uuid-5678",
      tenantId: res.locals.tenantId,
      title: "terms-of-service.md",
      status: "indexed",
      mimeType: "text/markdown",
      createdAt: new Date().toISOString()
    }
  ]);
});

// Get Document Metadata Route
app.get("/v1/documents/:id", authenticate, (req, res) => {
  res.status(200).json({
    id: req.params.id,
    tenantId: res.locals.tenantId,
    title: "refund-policy.pdf",
    status: "indexed",
    mimeType: "application/pdf",
    createdAt: new Date().toISOString()
  });
});

// Delete Document Route
app.delete("/v1/documents/:id", authenticate, (_req, res) => {
  res.status(204).send();
});

// Synchronous Query Route
app.post("/v1/query", authenticate, (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({
      type: "https://ragkb.dev/problems/validation-error",
      title: "Validation failed",
      status: 400,
      detail: "question is a required field."
    });
  }

  res.status(200).json({
    answer: `This is a simulated RAG response for tenant [${res.locals.tenantId}] (User: ${res.locals.email}, Role: ${res.locals.role}) to your question: "${question}". Based on your indexed documents, the refund policy allows requests within 30 days of purchase.`,
    citations: [
      { chunkId: "chunk-uuid-1", score: 0.942 }
    ]
  });
});

// Streaming SSE Query Route
app.post("/v1/query/stream", authenticate, (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({
      type: "https://ragkb.dev/problems/validation-error",
      title: "Validation failed",
      status: 400,
      detail: "question is a required field."
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const words = `This is a simulated streamed RAG response for tenant [${res.locals.tenantId}] (User: ${res.locals.email}, Role: ${res.locals.role}) to your question: "${question}". Based on the indexed documents, refunds must be submitted within 30 days of initial purchase.`.split(" ");
  
  let i = 0;
  const interval = setInterval(() => {
    if (i < words.length) {
      res.write(`data: ${JSON.stringify({ token: (words[i] ?? "") + " " })}\n\n`);
      i++;
    } else {
      res.write(`data: ${JSON.stringify({ 
        citations: [{ chunkId: "chunk-uuid-1", score: 0.942 }] 
      })}\n\n`);
      res.write("data: [DONE]\n\n");
      clearInterval(interval);
      res.end();
    }
  }, 100);

  req.on("close", () => {
    clearInterval(interval);
  });
});

// Usage Metrics Route
app.get("/v1/usage", authenticate, (_req, res) => {
  res.status(200).json({
    tenantId: res.locals.tenantId,
    monthlyBudget: 5000000,
    tokensUsed: 48920,
    costUsd: 0.1235,
    cacheHitRate: 0.35
  });
});

app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/health/ready", (_req, res) => res.status(200).json({ status: "ready" }));

app.listen(config.PORT, () => {
  console.log(`RAG Knowledge Base API listening on ${config.PORT}`);
});



