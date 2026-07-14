<p align="center">
  <img src="https://img.shields.io/badge/snippetfence-protect%20your%20code-FF6B6B?style=for-the-badge&logo=shield&logoColor=white" alt="snippetfence" />
</p>

<h1 align="center">snippetfence</h1>

<p align="center">
  <strong>Protect critical code regions from AI agent modification</strong><br>
  Drop fence markers around sensitive code. Agents respect them. Pre-commit hooks enforce them.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/snippetfence"><img src="https://img.shields.io/npm/v/snippetfence?style=flat-square&color=111111" alt="npm version"></a>
  <a href="https://github.com/snippetfence/snippetfence/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/snippetfence?style=flat-square&color=111111" alt="license"></a>
  <a href="#"><img src="https://img.shields.io/npm/dm/snippetfence?style=flat-square&color=111111" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/works%20with-15%2B%20agents-111111?style=flat-square" alt="works with 15+ agents">
</p>

---

**snippetfence** lets you mark code regions as protected using simple comment annotations. When AI coding agents (Claude Code, Cursor, Copilot, Codex, Gemini CLI, and more) read your code, they see the fence markers and know not to modify those regions. Pre-commit hooks provide hard enforcement — fenced code cannot be committed if modified.

## Quick Start

```bash
npx snippetfence init        # Install pre-commit hook
npx snippetfence generate    # Generate agent-specific instructions
npx snippetfence scan .      # Scan repo for protected regions
```

## How It Works

### 1. Mark protected regions with fence markers

```typescript
// @fence-begin authentication - do not modify
export function validateToken(token: string): boolean {
  // Critical auth logic — changes require security review
  const decoded = jwt.verify(token, SECRET_KEY);
  return decoded.exp > Date.now();
}
// @fence-end
```

```python
# @fence-begin payment processing - PCI compliance
def process_payment(amount: Decimal, card_token: str) -> PaymentResult:
    # Stripe integration — do not modify without security review
    charge = stripe.Charge.create(
        amount=int(amount * 100),
        currency="usd",
        source=card_token,
    )
    return PaymentResult(id=charge.id, status=charge.status)
# @fence-end
```

### 2. Generate instructions for your AI agent

```bash
npx snippetfence generate --format claude    # → CLAUDE.md
npx snippetfence generate --format agents    # → AGENTS.md
npx snippetfence generate --format cursor    # → .cursor/rules/snippetfence.mdc
npx snippetfence generate --format gemini    # → GEMINI.md
npx snippetfence generate --format copilot   # → .github/copilot-instructions.md
npx snippetfence generate --format all       # → all formats
```

### 3. Install pre-commit hook (hard enforcement)

```bash
npx snippetfence init              # Auto-detect hook manager
npx snippetfence init --manager husky
npx snippetfence init --manager lefthook
npx snippetfence init --manager pre-commit
```

## Install

### Claude Code

```bash
npm install -g snippetfence
```

Add to your `CLAUDE.md`:

```markdown
@AGENTS.md
```

Or symlink: `ln -s AGENTS.md CLAUDE.md`

### OpenAI Codex CLI

```bash
npm install -g snippetfence
```

Codex reads `AGENTS.md` automatically. Run `snippetfence generate` to create it.

### Cursor

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format cursor` to create `.cursor/rules/snippetfence.mdc`.

### GitHub Copilot

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format copilot` to create `.github/copilot-instructions.md`.

### Gemini CLI

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format gemini` to create `GEMINI.md`.

### Windsurf / Devin Desktop

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format windsurf` to create `.windsurfrules`.

### Cline

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format cline` to create `.clinerules/snippetfence.md`.

### OpenCode

```bash
npm install -g snippetfence
```

Codex reads `AGENTS.md` automatically. Run `snippetfence generate` to create it.

### Aider

```bash
npm install -g snippetfence
```

Add to `.aider.conf.yml`:

```yaml
read:
  - AGENTS.md
```

### Roo Code / Zed / Amp / Junie / Amazon Q / Devin

```bash
npm install -g snippetfence
```

All read `AGENTS.md` natively. Run `snippetfence generate` to create it.

## CLI Commands

| Command | Description |
|---------|-------------|
| `snippetfence check` | Check staged git changes against protected regions |
| `snippetfence scan <file>` | Scan a file for protected regions |
| `snippetfence scan .` | Scan entire repo for protected regions |
| `snippetfence list` | List all protected regions in the repo |
| `snippetfence init` | Install pre-commit hook |
| `snippetfence generate` | Generate agent instruction files |
| `snippetfence mcp` | Start MCP server for agent integration |

### Options

| Flag | Description |
|------|-------------|
| `--format <format>` | Output format: `claude`, `agents`, `cursor`, `gemini`, `copilot`, `windsurf`, `cline`, `all` |
| `--output <path>` | Output file path (default: auto-detect from format) |
| `--manager <manager>` | Hook manager: `husky`, `pre-commit`, `lefthook`, `raw`, `auto` (default: `auto`) |
| `--dry-run` | Preview output without writing files |
| `--root <dir>` | Root directory to scan (default: `.`) |

## Annotation Syntax

snippetfence supports comment annotations in **30+ languages**:

| Language | Syntax |
|----------|--------|
| TypeScript/JavaScript/Go/Rust/Java/C++/C#/Swift/Kotlin/Scala/PHP | `// @fence-begin` / `// @fence-end` |
| Python/Ruby/Shell/YAML/TOML/Makefile | `# @fence-begin` / `# @fence-end` |
| SQL | `-- @fence-begin` / `-- @fence-end` |
| HTML/XML/Vue/Svelte | `<!-- @fence-begin -->` / `<!-- @fence-end -->` |
| Lua | `-- @fence-begin` / `-- @fence-end` |
| Haskell | `-- @fence-begin` / `-- @fence-end` |

### Optional reason

```typescript
// @fence-begin PCI compliance - requires security review
export const stripeConfig = { ... };
// @fence-end
```

## How Enforcement Works

### Layer 1: Agent Instructions (advisory)

When you run `snippetfence generate`, it creates instruction files that tell AI agents about protected regions. Most agents will respect these instructions.

### Layer 2: Pre-commit Hook (enforced)

When you run `snippetfence init`, it installs a pre-commit hook that checks staged changes against protected regions. If a fenced region is modified, the commit is **blocked**.

```bash
$ git commit -m "update payment processing"
snippetfence: VIOLATION: src/payments.ts lines 15-42 (modified at line 23)
snippetfence: These regions are protected and cannot be modified.
snippetfence: Remove the @fence-begin/@fence-end annotations if this change is intentional.

husky - pre-commit hook exited with code 1
```

### Layer 3: MCP Server (real-time)

```bash
snippetfence mcp
```

Starts an MCP server that agents can query to check if a file region is protected before modifying it.

## MCP Integration

The MCP server exposes two tools:

- **`check_protection`** — Check if a file/line range is protected
- **`list_protections`** — List all protected regions in a file or directory

Configure in your MCP settings:

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

## Pre-commit Framework

snippetfence includes a `.pre-commit-hooks.yaml` for the [pre-commit](https://pre-commit.com/) framework:

```yaml
repos:
  - repo: https://github.com/snippetfence/snippetfence
    rev: v1.0.0
    hooks:
      - id: snippetfence
```

## GitHub Actions

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check protected regions
  run: npx snippetfence check
```

## FAQ

**Q: What if I need to modify a protected region?**
Remove the `@fence-begin`/`@fence-end` markers, make your change, and re-add them. The markers are the protection mechanism.

**Q: Does this work with monorepos?**
Yes. Run `snippetfence scan .` from the monorepo root to scan all packages.

**Q: Can I use custom annotation names?**
Currently snippetfence uses `@fence-begin`/`@fence-end`. Custom names are not yet supported.

**Q: What happens with unclosed fences?**
An unclosed `@fence-begin` (no matching `@fence-end`) protects from the begin marker to the end of the file.

**Q: Does the MCP server modify files?**
No. The MCP server is read-only — it only checks protection status.

## Development

```bash
git clone https://github.com/snippetfence/snippetfence.git
cd snippetfence
npm install
npm test
npm run build
```

## License

MIT
