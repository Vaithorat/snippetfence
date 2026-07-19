import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseContent } from './parser.js';
import { createFenceMarker, getMarkerStyle } from './syntax.js';
import type { AddFenceOptions, AddFenceResult } from './types.js';

export function addFence(filePath: string, options: AddFenceOptions): AddFenceResult {
  const absPath = path.resolve(filePath);
  const content = fs.readFileSync(absPath, 'utf-8');
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const style = getMarkerStyle(absPath, options.style ?? 'auto');
  const lines = content.split(/\r?\n/);
  const fileLineCount = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

  if (!Number.isInteger(options.startLine) || !Number.isInteger(options.endLine)) {
    throw new Error('start and end must be whole line numbers');
  }
  if (options.startLine < 1 || options.endLine < 1) {
    throw new Error('start and end must be positive line numbers');
  }
  if (options.startLine > options.endLine) {
    throw new Error('start must be less than or equal to end');
  }
  if (options.endLine > fileLineCount) {
    throw new Error(`end line ${options.endLine} is outside the file (max ${fileLineCount})`);
  }

  const existingRegions = parseContent(content, absPath);
  for (const region of existingRegions) {
    if (options.startLine <= region.endLine && options.endLine >= region.startLine) {
      throw new Error(`Requested range overlaps existing protected region ${region.id} (${region.startLine}-${region.endLine})`);
    }
  }

  const beginMarker = createFenceMarker(absPath, 'begin', options.reason, style);
  const endMarker = createFenceMarker(absPath, 'end', undefined, style);

  lines.splice(options.startLine - 1, 0, beginMarker);
  lines.splice(options.endLine + 1, 0, endMarker);
  fs.writeFileSync(absPath, lines.join(lineEnding), 'utf-8');

  return {
    filePath: absPath,
    beginLine: options.startLine,
    endLine: options.endLine + 2,
    style,
  };
}
