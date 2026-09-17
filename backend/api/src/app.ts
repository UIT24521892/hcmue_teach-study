import cors from "cors";
import express from "express";
import helmet from "helmet";

import { healthRouter } from "./features/health/health.route.js";
import { requestContext } from "./middleware/request-context.js";

export interface AppConfig {
  webOrigin: string;
}

export function createApp(config: AppConfig) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: config.webOrigin,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  app.use("/api/v1/health", healthRouter);

  app.use((request, response) => {
    response.status(404).json({
      code: "NOT_FOUND",
      message: `Không tìm thấy ${request.method} ${request.path}`,
      requestId: response.locals.requestId,
    });
  });

  return app;
}
