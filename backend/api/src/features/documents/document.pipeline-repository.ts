import { createPrismaDocumentPipelineRepository } from "@mach/document-pipeline";

import { prisma } from "../../lib/prisma.js";

export const documentPipelineRepository = createPrismaDocumentPipelineRepository(prisma);
