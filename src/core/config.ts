import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { EngineConfig } from './types.ts';

// Lazy-evaluated to avoid calling homedir() at module scope (breaks in serverless/bundled environments).
// Primary: ~/.gbrain (upstream-aligned, documented path, matches autopilot/install code).
// Legacy: ~/.rbrain (the fork's earlier branding). Read-only fallback for existing installs
// so the half-migrated state from before 2026-04-18 doesn't surprise anyone. New writes
// always go to ~/.gbrain.
function getConfigDir() { return join(homedir(), '.gbrain'); }
function getConfigPath() { return join(getConfigDir(), 'config.json'); }
function getLegacyConfigPath() { return join(homedir(), '.rbrain', 'config.json'); }

export interface GBrainConfig {
  engine: 'postgres' | 'pglite';
  database_url?: string;
  database_path?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
}

/**
 * Load config with credential precedence: env vars > config file.
 * Plugin config is handled by the plugin runtime injecting env vars.
 */
export function loadConfig(): GBrainConfig | null {
  let fileConfig: GBrainConfig | null = null;
  try {
    const raw = readFileSync(getConfigPath(), 'utf-8');
    fileConfig = JSON.parse(raw) as GBrainConfig;
  } catch {
    // No ~/.gbrain/config.json — try legacy ~/.rbrain/config.json once
    try {
      const raw = readFileSync(getLegacyConfigPath(), 'utf-8');
      fileConfig = JSON.parse(raw) as GBrainConfig;
    } catch { /* no config file at either location */ }
  }

  // Try env vars
  const dbUrl = process.env.RBRAIN_DATABASE_URL || process.env.GBRAIN_DATABASE_URL || process.env.DATABASE_URL;

  if (!fileConfig && !dbUrl) return null;

  // Infer engine type if not explicitly set
  const inferredEngine: 'postgres' | 'pglite' = fileConfig?.engine
    || (fileConfig?.database_path ? 'pglite' : 'postgres');

  // Merge: env vars override config file
  const merged = {
    ...fileConfig,
    engine: inferredEngine,
    ...(dbUrl ? { database_url: dbUrl } : {}),
    ...(process.env.OPENAI_API_KEY ? { openai_api_key: process.env.OPENAI_API_KEY } : {}),
  };
  return merged as GBrainConfig;
}

export function saveConfig(config: GBrainConfig): void {
  mkdirSync(getConfigDir(), { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(getConfigPath(), 0o600);
  } catch {
    // chmod may fail on some platforms
  }
}

export function toEngineConfig(config: GBrainConfig): EngineConfig {
  return {
    engine: config.engine,
    database_url: config.database_url,
    database_path: config.database_path,
  };
}

export function configDir(): string {
  return join(homedir(), '.gbrain');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}
