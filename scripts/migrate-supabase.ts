import { loadConfig } from "../src/core/config.ts";
import { createEngine } from "../src/core/engine-factory.ts";
import type { BrainEngine } from "../src/core/engine.ts";

const config = loadConfig();
if (!config) {
  console.error("No config. Run gbrain init first.");
  process.exit(1);
}

const database_url = process.env.DATABASE_URL;
if (!database_url) {
  console.error("No DATABASE_URL in env");
  process.exit(1);
}

console.log("Connecting to Supabase...");
const engineConfig = { ...config, database_url };
const engine: BrainEngine = await createEngine(engineConfig);
await engine.connect(engineConfig);

console.log("Connected. Running engine.initSchema() (DDL + migrations)...");
await engine.initSchema();

console.log("Running doctor check...");
const { connect, disconnect } = await import("../src/core/db.ts");
// Now doctor should pass
await disconnect();

console.log("Done!");
