import { Router } from "express";

import type { HealthStatus } from "@mach/contracts";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  const health: HealthStatus = {
    status: "ok",
    service: "mach-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };

  response.status(200).json(health);
});
