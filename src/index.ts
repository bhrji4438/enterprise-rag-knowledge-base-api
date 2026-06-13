import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import pinoHttpModule from "pino-http";
import jwt from "jsonwebtoken";
import path from "node:path";
import fs from "node:fs";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { loadConfig } from "./config/env.js";
import { createDependencies } from "./composition-root.js";
import { authController } from "./controllers/auth.controller.js";
import { documentController } from "./controllers/document.controller.js";
import { queryController } from "./controllers/query.controller.js";
import { usageController } from "./controllers/usage.controller.js";
import { healthController } from "./controllers/health.controller.js";
import { requireRole } from "./shared/middleware/rbac.js";
import { globalErrorHandler } from "./shared/middleware/error-handler.js";
import { asyncHandler } from "./shared/middleware/async-handler.js";

// ── Config ─────────────────────────────────────────────────────────────────
const config = loadConfig();

// ── Process-level error guards ─────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err);
  process.exit(1);
});

// ── Express app ────────────────────────────────────────────────────────────
const app = express();
const pinoHttp = pinoHttpModule as unknown as () => express.RequestHandler;

// ── Security middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Only relax CSP for the Swagger UI dev route
        "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        "img-src": ["'self'", "data:", "https://unpkg.com"],
      },
    },
  })
);

// CORS — allowlist from config; open in dev if ALLOWED_ORIGINS is empty
const allowedOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 && config.NODE_ENV !== "production") {
        return cb(null, true); // open in dev
      }
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin "${origin}" is not allowed`));
    },
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(pinoHttp());

// ── Rate limiter ───────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_SECONDS * 1000,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Use in-memory store here; swap for RedisStore in production
  keyGenerator: (req) => {
    const tenantId = (req as express.Request & { locals?: { tenantId?: string } }).res?.locals?.[
      "tenantId"
    ] as string | undefined;
    return tenantId ?? req.ip ?? "unknown";
  },
  message: {
    type: "https://ragkb.dev/problems/rate-limit-exceeded",
    title: "Rate limit exceeded",
    status: 429,
    detail: `Too many requests. Limit is ${config.RATE_LIMIT_MAX_REQUESTS} per ${config.RATE_LIMIT_WINDOW_SECONDS}s.`,
  },
});

app.use("/v1/", apiLimiter);

// ── Authentication middleware ───────────────────────────────────────────────
function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res
      .status(401)
      .setHeader("Content-Type", "application/problem+json")
      .json({
        type: "https://ragkb.dev/problems/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Missing or invalid Authorization header. Obtain a JWT from POST /v1/auth/token.",
      });
    return;
  }

  const token = authHeader.split(" ")[1] ?? "";
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    }) as { tenantId: string; role: string; email: string };

    res.locals["tenantId"] = decoded.tenantId;
    res.locals["role"] = decoded.role;
    res.locals["email"] = decoded.email;
    next();
  } catch {
    res
      .status(401)
      .setHeader("Content-Type", "application/problem+json")
      .json({
        type: "https://ragkb.dev/problems/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid or expired JWT token.",
      });
  }
}

// ── File upload middleware ─────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["text/plain", "text/markdown", "text/x-markdown"]);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ── Dev-only: OpenAPI spec + Swagger UI ───────────────────────────────────
if (config.NODE_ENV !== "production") {
  app.get("/openapi.yaml", (_req, res) => {
    const yamlPath = path.join(process.cwd(), "docs", "openapi.yaml");
    if (fs.existsSync(yamlPath)) {
      res.setHeader("Content-Type", "text/yaml");
      res.sendFile(yamlPath);
    } else {
      res.status(404).send("openapi.yaml not found");
    }
  });

  app.get("/docs", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RAG Knowledge Base API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>html{box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}body{margin:0;background:#fafafa}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml', dom_id: '#swagger-ui', deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        responseInterceptor: (r) => {
          if (r.url.endsWith('/v1/auth/token') && r.status === 200 && r.body?.token) {
            ui.preauthorizeApiKey('bearerAuth', r.body.token);
          }
          return r;
        }
      });
    };
  </script>
</body>
</html>`);
  });
}

// ── Dependency bootstrap + routes ─────────────────────────────────────────
export const appPromise = createDependencies().then((deps) => {
  const auth = authController();
  const docs = documentController({
    documentRepository: deps.documentRepository,
    ingestionQueue: deps.ingestionQueue,
  });
  const query = queryController({ answerService: deps.answerService });
  const usage = usageController({
    redis: deps.redis,
    monthlyBudget: config.TENANT_MONTHLY_TOKEN_BUDGET,
  });
  const health = healthController({ redis: deps.redis, db: deps.db });

  // ── Health probes (no auth) ────────────────────────────────────────────
  app.get("/health/live", (req, res) => health.live(req, res));
  app.get("/health/ready", asyncHandler((req, res) => health.ready(req, res)));

  // ── Auth ───────────────────────────────────────────────────────────────
  app.post("/v1/auth/token", (req, res) => auth.issueToken(req, res));

  // ── Documents ──────────────────────────────────────────────────────────
  app.post(
    "/v1/documents",
    authenticate,
    requireRole("owner", "admin", "engineer"),
    upload.single("file"),
    asyncHandler((req, res) => docs.upload(req, res))
  );
  app.get(
    "/v1/documents",
    authenticate,
    requireRole("owner", "admin", "engineer", "viewer"),
    asyncHandler((req, res) => docs.list(req, res))
  );
  app.get(
    "/v1/documents/:id",
    authenticate,
    requireRole("owner", "admin", "engineer", "viewer"),
    asyncHandler((req, res) => docs.getById(req, res))
  );
  app.delete(
    "/v1/documents/:id",
    authenticate,
    requireRole("owner", "admin"),
    asyncHandler((req, res) => docs.remove(req, res))
  );

  // ── Query ──────────────────────────────────────────────────────────────
  app.post(
    "/v1/query",
    authenticate,
    requireRole("owner", "admin", "engineer", "viewer"),
    asyncHandler((req, res) => query.query(req, res))
  );
  app.post(
    "/v1/query/stream",
    authenticate,
    requireRole("owner", "admin", "engineer", "viewer"),
    asyncHandler((req, res) => query.stream(req, res))
  );

  // ── Usage ──────────────────────────────────────────────────────────────
  app.get(
    "/v1/usage",
    authenticate,
    requireRole("owner", "admin"),
    asyncHandler((req, res) => usage.getUsage(req, res))
  );

  // ── Global error handler (must be last) ───────────────────────────────
  app.use(globalErrorHandler);

  // ── Start server ───────────────────────────────────────────────────────
  if (config.NODE_ENV !== "test") {
    app.listen(config.PORT, () => {
      console.info(`[server] RAG Knowledge Base API listening on port ${config.PORT}`);
      console.info(`[server] Environment: ${config.NODE_ENV}`);
      console.info(`[server] Mocks: ${config.USE_MOCKS}`);
    });
  }

  return app;
}).catch((err: unknown) => {
  console.error("[startup] Failed to initialise dependencies:", err);
  process.exit(1);
});
