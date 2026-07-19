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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
