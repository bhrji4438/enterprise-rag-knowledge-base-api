import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import pinoHttpModule from "pino-http";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = express();
const pinoHttp = pinoHttpModule as unknown as () => express.RequestHandler;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(pinoHttp());

app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/health/ready", (_req, res) => res.status(200).json({ status: "ready" }));

app.listen(config.PORT, () => {
  console.log(`RAG Knowledge Base API listening on ${config.PORT}`);
});
