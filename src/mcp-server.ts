import * as path from 'node:path';
import { parseFile, parseRepo } from './parser.js';
import type { ProtectedRegion } from './types.js';
import { VERSION } from './version.js';

export async function createMcpServer(): Promise<import('@modelcontextprotocol/sdk/server/mcp.js').McpServer> {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { z } = await import('zod');

  const server = new McpServer({
    name: 'snippetfence',
    version: VERSION,
  });

  server.tool(
    'check_protection',
    'Check if a file or line range is protected by fence annotations',
    {
      file: z.string().describe('Path to the file to check'),
      startLine: z.number().optional().describe('Start line number (optional)'),
      endLine: z.number().optional().describe('End line number (optional)'),
    },
    async ({ file, startLine, endLine }) => {
      try {
        const result = getProtectionResult(file, startLine, endLine);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'list_protections',
    'List all protected regions in a directory or the entire repository',
    {
      directory: z.string().optional().describe('Directory to scan (defaults to current directory)'),
    },
    async ({ directory }) => {
      try {
        const dir = directory ?? process.cwd();
        const result = listProtectionResults(dir);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

export function getProtectionResult(file: string, startLine?: number, endLine?: number): Record<string, unknown> {
  const regions = parseFile(file);
  const protectedRegions = startLine !== undefined && endLine !== undefined
    ? regions.filter(region => region.startLine <= endLine && region.endLine >= startLine)
    : regions;

  return {
    protected: protectedRegions.length > 0,
    regions: protectedRegions.map(serializeRegion),
  };
}

export function listProtectionResults(directory: string): Record<string, unknown>[] {
  return parseRepo(directory).map(region => ({
    file: path.relative(directory, region.filePath).replace(/\\/g, '/'),
    ...serializeRegion(region),
  }));
}

function serializeRegion(region: ProtectedRegion): Record<string, unknown> {
  return {
    id: region.id,
    startLine: region.startLine,
    endLine: region.endLine,
    reason: region.reason,
    severity: region.severity,
    owners: region.owners,
    tags: region.tags,
    message: region.message,
  };
}

export async function startMcpServer(): Promise<void> {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
