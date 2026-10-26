import { PrismaClient } from "../generated/prisma/index.js";

export { Prisma, PrismaClient } from "../generated/prisma/index.js";
export type { Company } from "../generated/prisma/index.js";

export function createDb(): PrismaClient {
  return new PrismaClient();
}
