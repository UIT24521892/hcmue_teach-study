import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { AppConfig } from "./config/app-config.js";
import { createAttemptRouter } from "./features/attempts/attempt.route.js";
import { createAuthRouter } from "./features/auth/auth.route.js";
import { createDocumentRouter } from "./features/documents/document.route.js";
import { healthRouter } from "./features/health/health.route.js";
import { createNoteRouter } from "./features/notes/note.route.js";
import { createQuizRouter } from "./features/quizzes/quiz.route.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";

export type { AppConfig, AuthConfig } from "./config/app-config.js";

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
  // Required to read the httpOnly refresh cookie on /auth/refresh and /auth/logout.
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", createAuthRouter({ ...config.auth }));
  const documentRouter = createDocumentRouter({
    accessTokenSecret: config.auth.accessTokenSecret,
    ...config.documents,
  });
  app.use("/api/v1/documents", documentRouter);
  app.use("/api/v1/notes", createNoteRouter({ accessTokenSecret: config.auth.accessTokenSecret }));
  // Before the quiz router: its owner-only role gate would reject learners.
  app.use("/api/v1", createAttemptRouter({ accessTokenSecret: config.auth.accessTokenSecret }));
  app.use(
    "/api/v1/quizzes",
    createQuizRouter({ accessTokenSecret: config.auth.accessTokenSecret }),
  );
  app.locals.closeResources = () => documentRouter.closeResources();

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
