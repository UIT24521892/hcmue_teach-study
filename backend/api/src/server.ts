import { createServer } from "node:http";

import { createApp } from "./app.js";
import { loadEnvFiles, parseEnv } from "./config/env.js";

loadEnvFiles();
const env = parseEnv(process.env);
const app = createApp({ webOrigin: env.WEB_ORIGIN });
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

function shutdown(signal: NodeJS.Signals): void {
  console.info(JSON.stringify({ level: "info", message: "API shutting down", signal }));
  server.close((error) => {
    if (error) {
      console.error(JSON.stringify({ level: "error", message: error.message }));
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
