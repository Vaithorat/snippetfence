import type { SyntaxStyle } from './types.js';

// Maps file extension to comment syntax for fence markers
const SYNTAX_MAP: Record<string, SyntaxStyle> = {
  // C-family
  '.ts':   { lineComment: '//', blockComment: ['/*', '*/'] },
  '.tsx':  { lineComment: '//', blockComment: ['/*', '*/'] },
  '.js':   { lineComment: '//', blockComment: ['/*', '*/'] },
  '.jsx':  { lineComment: '//', blockComment: ['/*', '*/'] },
  '.mjs':  { lineComment: '//', blockComment: ['/*', '*/'] },
  '.cjs':  { lineComment: '//', blockComment: ['/*', '*/'] },
  '.go':   { lineComment: '//', blockComment: ['/*', '*/'] },
  '.rs':   { lineComment: '//', blockComment: ['/*', '*/'] },
  '.java': { lineComment: '//', blockComment: ['/*', '*/'] },
  '.c':    { lineComment: '//', blockComment: ['/*', '*/'] },
  '.cpp':  { lineComment: '//', blockComment: ['/*', '*/'] },
  '.cs':   { lineComment: '//', blockComment: ['/*', '*/'] },
  '.swift':{ lineComment: '//', blockComment: ['/*', '*/'] },
  '.kt':   { lineComment: '//', blockComment: ['/*', '*/'] },
  '.scala':{ lineComment: '//', blockComment: ['/*', '*/'] },
  '.php':  { lineComment: '//', blockComment: ['/*', '*/'] },
  '.scss': { lineComment: '//', blockComment: ['/*', '*/'] },
  '.css':  { blockComment: ['/*', '*/'] },

  // Python-family
  '.py':   { lineComment: '#' },
  '.rb':   { lineComment: '#' },
  '.sh':   { lineComment: '#' },
  '.bash': { lineComment: '#' },
  '.yaml': { lineComment: '#' },
  '.yml':  { lineComment: '#' },
  '.toml': { lineComment: '#' },
  '.ini':  { lineComment: '#' },
  '.r':    { lineComment: '#' },
  '.pl':   { lineComment: '#' },

  // SQL
  '.sql':  { lineComment: '--', blockComment: ['/*', '*/'] },

  // HTML family
  '.html': { blockComment: ['<!--', '-->'] },
  '.xml':  { blockComment: ['<!--', '-->'] },
  '.vue':  { blockComment: ['<!--', '-->'] },
  '.svelte': { blockComment: ['<!--', '-->'] },

  // Lua
  '.lua':  { lineComment: '--', blockComment: ['--[[', '--]]'] },

  // Haskell
  '.hs':   { lineComment: '--', blockComment: ['{-', '-}'] },
};

const DEFAULT_SYNTAX: SyntaxStyle = { lineComment: '//' };

export function getSyntaxForFile(filePath: string): SyntaxStyle {
  const ext = getExtension(filePath);
  return SYNTAX_MAP[ext] ?? DEFAULT_SYNTAX;
}

export function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastDot === -1 || lastDot < lastSlash) return '';
  return filePath.slice(lastDot).toLowerCase();
}

export function getBeginPattern(syntax: SyntaxStyle): RegExp {
  const reasonPattern = '(?:\\s+(?:"([^"]*)"|(.*?)))?';
  if (syntax.lineComment) {
    const escaped = escapeRegex(syntax.lineComment);
    return new RegExp(`^\\s*${escaped}\\s*@fence-begin${reasonPattern}\\s*$`);
  }
  if (syntax.blockComment) {
    const [open, close] = syntax.blockComment;
    const escapedOpen = escapeRegex(open);
    const escapedClose = escapeRegex(close);
    return new RegExp(`^\\s*${escapedOpen}\\s*@fence-begin${reasonPattern}\\s*(?:${escapedClose})?\\s*$`);
  }
  return new RegExp(`@fence-begin${reasonPattern}\\s*$`);
}

export function getEndPattern(syntax: SyntaxStyle): RegExp {
  if (syntax.lineComment) {
    const escaped = escapeRegex(syntax.lineComment);
    return new RegExp(`^\\s*${escaped}\\s*@fence-end\\s*$`);
  }
  if (syntax.blockComment) {
    const [, close] = syntax.blockComment;
    const escaped = escapeRegex(close);
    return new RegExp(`@fence-end\\s*${escaped}`);
  }
  return /@fence-end\s*$/;
}

export function getMarkerStyle(filePath: string, style: 'auto' | 'line' | 'block' = 'auto'): 'line' | 'block' {
  const syntax = getSyntaxForFile(filePath);

  if (style === 'line') {
    if (!syntax.lineComment) {
      throw new Error(`Line comment markers are not supported for ${filePath}`);
    }
    return 'line';
  }

  if (style === 'block') {
    if (!syntax.blockComment) {
      throw new Error(`Block comment markers are not supported for ${filePath}`);
    }
    return 'block';
  }

  if (syntax.lineComment) {
    return 'line';
  }
  if (syntax.blockComment) {
    return 'block';
  }

  throw new Error(`Could not infer a supported fence marker style for ${filePath}`);
}

export function createFenceMarker(
  filePath: string,
  marker: 'begin' | 'end',
  reason?: string,
  style: 'auto' | 'line' | 'block' = 'auto'
): string {
  const syntax = getSyntaxForFile(filePath);
  const resolvedStyle = getMarkerStyle(filePath, style);
  const suffix = marker === 'begin' && reason ? ` ${reason}` : '';

  if (resolvedStyle === 'line' && syntax.lineComment) {
    return `${syntax.lineComment} @fence-${marker}${suffix}`;
  }

  if (resolvedStyle === 'block' && syntax.blockComment) {
    const [open, close] = syntax.blockComment;
    return `${open} @fence-${marker}${suffix} ${close}`;
  }

  throw new Error(`Could not build ${resolvedStyle} fence markers for ${filePath}`);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
