import { createServer } from "node:http";

import { createApp } from "./app.js";
import { createAppConfig } from "./config/app-config.js";
import { loadEnvFiles, parseEnv } from "./config/env.js";

loadEnvFiles();
const env = parseEnv(process.env);
const app = createApp(createAppConfig(env));
const server = createServer(app);

server.listen(env.API_PORT, () => {
  console.info(
    JSON.stringify({
      level: "info",
      message: "API ready",
      port: env.API_PORT,
      environment: env.NODE_ENV,
    }),
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.info(JSON.stringify({ level: "info", message: "API shutting down", signal }));
  await app.locals.closeResources();
  server.close((error) => {
    if (error) {
      console.error(JSON.stringify({ level: "error", message: error.message }));
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
