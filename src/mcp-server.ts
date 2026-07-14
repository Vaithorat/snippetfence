import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { parseFile, parseRepo } from './parser.js';
import type { ProtectedRegion } from './types.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'snippetfence',
    version: '1.0.0',
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
        const regions = parseFile(file);
        let protectedRegions = regions;

        if (startLine !== undefined && endLine !== undefined) {
          protectedRegions = regions.filter(
            r => r.startLine <= endLine && r.endLine >= startLine
          );
        }

        const result = {
          protected: protectedRegions.length > 0,
          regions: protectedRegions.map(r => ({
            id: r.id,
            startLine: r.startLine,
            endLine: r.endLine,
            reason: r.reason,
          })),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
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
        const regions = parseRepo(dir);

        const result = regions.map(r => ({
          file: r.filePath,
          startLine: r.startLine,
          endLine: r.endLine,
          reason: r.reason,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
