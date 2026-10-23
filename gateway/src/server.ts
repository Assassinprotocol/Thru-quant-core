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

  registerRoutes(app, config.db);

  return app;
}
