import { prepareTestEnvironment } from "./environment.js";

// Runs before any test module — and therefore before the Prisma client
// singleton reads DATABASE_URL.
prepareTestEnvironment();
