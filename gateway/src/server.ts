import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { GatewayConfig } from "./types.ts";
import { registerRoutes } from "./routes.ts";

export async function createGatewayServer(config: GatewayConfig): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
    trustProxy: config.trustedProxies && config.trustedProxies.length > 0
      ? config.trustedProxies
      : true,
  });

  await app.register(cors, {
    origin: config.corsOrigin ?? true,
    methods: ["GET", "HEAD", "OPTIONS"],
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax ?? 1000,
    timeWindow: config.rateLimitWindowMs ?? 60000,
  });

  app.setErrorHandler((error: any, _req, reply) => {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    reply.status(status).send({
      error: error.message || "Internal server error",
      code: (error as any).code || "ORACLE_INTERNAL_ERROR",
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      error: "Endpoint not found",
      code: "ORACLE_ENDPOINT_NOT_FOUND",
    });
  });

  registerRoutes(app, config.db);

  return app;
}
