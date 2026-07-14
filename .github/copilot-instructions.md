# snippetfence — Copilot Instructions

## Protected Regions

This project uses `@fence-begin`/`@fence-end` annotations to mark code regions as protected from AI modification.

### Rules

1. **Do not modify** code inside `@fence-begin`/`@fence-end` regions
2. Read fenced regions for context, but do not suggest changes
3. If a task requires modifying a fenced region, inform the user and ask for confirmation
4. The reason after `@fence-begin` (e.g., "PCI compliance") indicates high sensitivity

### Checking Protection

```bash
npx snippetfence list         # List all protected regions
npx snippetfence scan <file>  # Check a specific file
npx snippetfence check        # Check staged changes
```

### Enforcement

A pre-commit hook blocks commits that modify protected regions. To modify a fenced region:
1. Remove the `@fence-begin`/`@fence-end` markers
2. Make the change
3. Re-add the markers if the region should remain protected

## Project Structure

```
src/
├── cli.ts          # CLI entry point (cac framework)
├── parser.ts       # Parses @fence-begin/@fence-end markers
├── enforcer.ts     # Checks git diffs against protected regions
├── hook.ts         # Installs pre-commit hooks
├── generate.ts     # Generates agent instruction files
├── mcp-server.ts   # MCP server for real-time checks
├── syntax.ts       # Language comment syntax patterns
├── types.ts        # TypeScript interfaces
└── utils.ts        # Git and file utilities
```

## Development

```bash
npm install
npm test
npm run build
```
