# snippetfence — Agent Instructions

## What is snippetfence?

snippetfence is a code protection tool that uses comment annotations to mark code regions as off-limits to AI coding agents. It provides both advisory (instruction files) and enforced (pre-commit hooks) protection.

## Protected Regions

Files may contain protected regions marked with `@fence-begin` and `@fence-end` annotations. These regions MUST NOT be modified by AI agents without explicit human approval.

### Annotation Syntax

```typescript
// @fence-begin <optional reason>
// ... protected code ...
// @fence-end
```

```python
# @fence-begin <optional reason>
# ... protected code ...
# @fence-end
```

### Rules for AI Agents

1. **NEVER modify code inside `@fence-begin`/`@fence-end` regions** unless the user explicitly approves the change
2. When you encounter a fenced region, **read it for context** but do not suggest changes to it
3. If a task requires modifying a fenced region, **tell the user** which regions are affected and ask for confirmation
4. The `@fence-begin` marker may include a quoted or unquoted reason (e.g., `"PCI compliance"` or `PCI compliance`) — treat these as high-sensitivity indicators

### Checking Protection Status

Run `snippetfence list` to see all protected regions in the project:

```bash
npx snippetfence list
```

Run `snippetfence scan <file>` to check a specific file:

```bash
npx snippetfence scan src/payments.ts
```

### Enforcement

snippetfence installs a pre-commit hook that blocks commits modifying protected regions. The hook also detects fenced file deletions and renames that strip fence markers. If your changes are blocked:

1. Review which fenced regions are affected
2. If the change is intentional, remove the `@fence-begin`/`@fence-end` markers
3. Make the change
4. Re-add the markers if the region should remain protected

### MCP Integration

snippetfence provides an MCP server for real-time protection checks:

```json
{
  "mcpServers": {
    "snippetfence": {
      "command": "npx",
      "args": ["snippetfence", "mcp"]
    }
  }
}
```

Tools available:
- `check_protection` — Check if a file/line range is protected
- `list_protections` — List all protected regions

## Project Structure

```
snippetfence/
├── src/
│   ├── cli.ts          # CLI entry point
│   ├── parser.ts       # Fence marker parser
│   ├── enforcer.ts     # Git diff enforcement
│   ├── config.ts       # YAML/legacy config loading
│   ├── hook.ts         # Pre-commit hook installer
│   ├── generate.ts     # Agent instruction generator
│   ├── mcp-server.ts   # MCP server
│   ├── report.ts       # JSON/SARIF report builders
│   ├── syntax.ts       # Language syntax patterns
│   ├── types.ts        # TypeScript interfaces
│   └── utils.ts        # Git and file utilities
├── tests/              # Test suite
└── dist/               # Build output
```

## Development

```bash
npm install
npm test
npm run build
```

## Common Commands

```bash
npx snippetfence check        # Check staged changes
npx snippetfence check --all  # Check staged, unstaged, and untracked changes
npx snippetfence scan .       # Scan repo
npx snippetfence list         # List protected regions
npx snippetfence validate     # Validate config and fences
npx snippetfence init         # Install pre-commit hook
npx snippetfence generate     # Generate agent instructions
npx snippetfence mcp          # Start MCP server
```
