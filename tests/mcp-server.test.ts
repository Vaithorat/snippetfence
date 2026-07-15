import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/mcp-server.js';

describe('createMcpServer', () => {
  it('creates a server instance with connect method', async () => {
    const server = await createMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
    expect(typeof server.close).toBe('function');
  });
});
