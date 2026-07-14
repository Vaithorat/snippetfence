import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { getSyntaxForFile, getBeginPattern, getEndPattern } from './syntax.js';
import type { ProtectedRegion } from './types.js';

let regionCounter = 0;

export function parseFile(filePath: string): ProtectedRegion[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseContent(content, filePath);
}

export function parseContent(content: string, filePath: string): ProtectedRegion[] {
  const syntax = getSyntaxForFile(filePath);
  const beginRegex = getBeginPattern(syntax);
  const endRegex = getEndPattern(syntax);
  const lines = content.split('\n');
  const regions: ProtectedRegion[] = [];
  let openRegion: { startLine: number; reason?: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (openRegion === null) {
      const beginMatch = beginRegex.exec(line);
      if (beginMatch) {
        openRegion = { startLine: lineNum, reason: beginMatch[1] || undefined };
      }
    } else {
      if (endRegex.test(line)) {
        regionCounter++;
        regions.push({
          id: `region-${regionCounter}`,
          startLine: openRegion.startLine,
          endLine: lineNum,
          filePath: path.resolve(filePath),
          reason: openRegion.reason,
        });
        openRegion = null;
      }
    }
  }

  // Handle unclosed fence: protect from begin to EOF
  if (openRegion !== null) {
    regionCounter++;
    regions.push({
      id: `region-${regionCounter}`,
      startLine: openRegion.startLine,
      endLine: lines.length,
      filePath: path.resolve(filePath),
      reason: openRegion.reason,
    });
  }

  return regions;
}

export function parseRepo(rootDir: string, patterns: string[] = ['**/*.{ts,tsx,js,jsx,go,rs,py,java,c,cpp,cs,swift,kt,scala,php,sql,html,xml,vue,svelte,lua,hs,yaml,yml,toml,sh,bash,r,rb,pl,ini,mjs,cjs,scss,css}']): ProtectedRegion[] {
  const files: string[] = fg.sync(patterns, {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
  });

  const allRegions: ProtectedRegion[] = [];
  for (const file of files) {
    try {
      const regions = parseFile(file);
      allRegions.push(...regions);
    } catch {
      // Skip files that can't be read
    }
  }
  return allRegions;
}

export function resetCounter(): void {
  regionCounter = 0;
}
