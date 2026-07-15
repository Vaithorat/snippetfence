import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SnippetfenceConfig {
  exclude?: string[];
  include?: string[];
}

const CONFIG_FILE = '.snippetfencerules';

export function loadConfig(cwd: string): SnippetfenceConfig {
  const configPath = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return parseConfig(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Warning: Could not read ${CONFIG_FILE}: ${msg}\n`);
    return {};
  }
}

export function parseConfig(content: string): SnippetfenceConfig {
  const config: SnippetfenceConfig = {};
  const lines = content.split('\n');
  let currentSection: 'exclude' | 'include' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === '[exclude]') {
      currentSection = 'exclude';
      continue;
    }
    if (trimmed === '[include]') {
      currentSection = 'include';
      continue;
    }

    if (currentSection === 'exclude') {
      if (!config.exclude) config.exclude = [];
      config.exclude.push(trimmed);
    } else if (currentSection === 'include') {
      if (!config.include) config.include = [];
      config.include.push(trimmed);
    }
  }

  return config;
}

export function getConfigFilePath(cwd: string): string {
  return path.join(cwd, CONFIG_FILE);
}

export function hasConfig(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, CONFIG_FILE));
}
