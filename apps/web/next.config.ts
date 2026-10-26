import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// One .env for the whole repo, at the root.
process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));

const config: NextConfig = {
  // The pipeline package ships TypeScript source; Next compiles it.
  transpilePackages: ["@jobfox/pipeline"],
};

export default config;
