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
  <a href="https://github.com/Vaithorat/snippetfence/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Vaithorat/snippetfence?style=flat-square&color=111111" alt="license"></a>
  <a href="https://www.npmjs.com/package/snippetfence"><img src="https://img.shields.io/npm/dm/snippetfence?style=flat-square&color=111111" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/works%20with-15%2B%20agents-111111?style=flat-square" alt="works with 15+ agents">
</p>

---

**snippetfence** lets you mark code regions as protected using simple comment annotations. When AI coding agents (Claude Code, Cursor, Copilot, Codex, Gemini CLI, and more) read your code, they see the fence markers and know not to modify those regions. Pre-commit hooks provide hard enforcement — fenced code cannot be committed if modified.

`v1.2` adds enforcement completeness: deletion of fenced files, rename detection, config-scoped enforcement, violation grouping, and Windows CI.

## Quick Start

```bash
npx snippetfence init        # Install pre-commit hook
npx snippetfence generate    # Generate agent-specific instructions
npx snippetfence scan .      # Scan repo for protected regions
npx snippetfence check --all # Check staged, unstaged, and untracked changes
npx snippetfence validate    # Validate config and fence layout
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
npx snippetfence generate --format claude-md    # → CLAUDE.md
npx snippetfence generate --format agents-md    # → AGENTS.md
npx snippetfence generate --format cursor-mdc   # → .cursor/rules/snippetfence.mdc
npx snippetfence generate --format gemini-md    # → GEMINI.md
npx snippetfence generate --format copilot      # → .github/copilot-instructions.md
npx snippetfence generate --format windsurf     # → .windsurfrules
npx snippetfence generate --format cline        # → .clinerules/snippetfence.md
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

Run `snippetfence generate --format cursor-mdc` to create `.cursor/rules/snippetfence.mdc`.

### GitHub Copilot

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format copilot` to create `.github/copilot-instructions.md`.

### Gemini CLI

```bash
npm install -g snippetfence
```

Run `snippetfence generate --format gemini-md` to create `GEMINI.md`.

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

Run `snippetfence generate` to create `AGENTS.md`, then reference it from your OpenCode agent instructions.

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
| `snippetfence validate` | Validate config and fence layout across the repo |
| `snippetfence add <file>` | Insert fence markers around a line range |
| `snippetfence scan <file>` | Scan a file for protected regions |
| `snippetfence scan .` | Scan entire repo for protected regions |
| `snippetfence list` | List all protected regions in the repo |
| `snippetfence init` | Install pre-commit hook |
| `snippetfence generate` | Generate agent instruction files |
| `snippetfence doctor` | Diagnose hook and project setup |
| `snippetfence mcp` | Start MCP server for agent integration |

### Common options

| Flag | Description |
|------|-------------|
| `--format <format>` | Output format: `claude-md`, `agents-md`, `cursor-rules`, `cursor-mdc`, `gemini-md`, `copilot`, `windsurf`, `cline` |
| `--output <path>` | Output file path (default: auto-detect from format) |
| `--manager <manager>` | Hook manager: `husky`, `pre-commit`, `lefthook`, `raw`, `auto` (default: `auto`) |
| `--dry-run` | Preview violations without failing the commit |
| `--root <dir>` | Root directory to scan (default: `.`) |
| `--all` | Check staged, unstaged, and untracked changes |
| `--ci` | Output machine-readable JSON (for `check` and `doctor` commands) |

### `check` options

| Flag | Description |
|------|-------------|
| `--format text|json|sarif` | Select human or machine-readable output |
| `--report-file <path>` | Write JSON or SARIF output to a file |
| `--base <git-ref>` | Compare protected changes from a base ref |
| `--head <git-ref>` | Compare against an explicit head ref (default: `HEAD`) |
| `--fail-on warn|error` | Treat warnings as blocking, or only block on errors |

### `add` options

| Flag | Description |
|------|-------------|
| `--start <line>` | First line to protect |
| `--end <line>` | Last line to protect |
| `--reason <text>` | Optional inline reason to append to `@fence-begin` |
| `--style auto|line|block` | Force comment style instead of auto-detecting |

## Policy-Aware Config

`snippetfence` still supports legacy `.snippetfencerules`, but `v1.1` introduces `snippetfence.yml` as the primary config format.

```yaml
defaults:
  severity: error

include:
  - "src/**/*"

exclude:
  - "dist/**"

rules:
  - paths:
      - "src/payments/**"
    severity: error
    owners:
      - security
    tags:
      - pci
    message: "Requires security review"

  - paths:
      - "src/auth/**"
    severity: warn
    owners:
      - platform
    tags:
      - auth
```

Policy resolution rules:

- `snippetfence.yml` takes precedence when present.
- If YAML is absent, `.snippetfencerules` still works unchanged.
- Defaults are applied first, then every matching rule is merged in declaration order.
- Later scalar values override earlier ones.
- `owners` and `tags` replace earlier arrays instead of appending.

## CI And Reporting

Text output remains the default for local use. For automation, use JSON or SARIF.

```bash
npx snippetfence check --format json
npx snippetfence check --format sarif --report-file reports/snippetfence.sarif
npx snippetfence check --base origin/main --head HEAD --fail-on error
```

`--fail-on warn` blocks on both warnings and errors. `--fail-on error` reports warnings but only fails on error-severity regions.

## Validate Repo Health

```bash
npx snippetfence validate
npx snippetfence validate --ci
```

`validate` reports:

- malformed YAML or invalid config shape
- invalid globs or unknown config keys
- unmatched or duplicate rule sets where detectable
- nested, unclosed, or otherwise malformed fence layouts

## Add Fences Safely

```bash
npx snippetfence add src/auth.ts --start 10 --end 24 --reason "security review"
npx snippetfence add templates/page.html --start 5 --end 18 --style block
```

The command preserves existing line endings, infers comment syntax when possible, and refuses overlapping or unsupported edits instead of guessing.

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

Reasons may be quoted or unquoted.

## How Enforcement Works

### Layer 1: Agent Instructions (advisory)

When you run `snippetfence generate`, it creates instruction files that tell AI agents about protected regions. Most agents will respect these instructions.

### Layer 2: Pre-commit Hook (enforced)

When you run `snippetfence init`, it installs a pre-commit hook that checks staged changes against protected regions. If a fenced region is modified, the commit is **blocked**. The hook also detects fenced file deletions and renames that strip fence markers. For a manual full working tree check, run `snippetfence check --all`.

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

Both responses now include policy metadata for each protected region:

- `severity`
- `owners`
- `tags`
- `message`
- inline fence `reason`

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
  - repo: https://github.com/Vaithorat/snippetfence
    rev: <git-tag>
    hooks:
      - id: snippetfence
```

Pin `rev` to the release tag you want to enforce in your repo.

## GitHub Actions

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check protected regions
  run: npx snippetfence check --base origin/main --head HEAD --format sarif --report-file snippetfence.sarif

- name: Validate snippetfence config and fences
  run: npx snippetfence validate
```

## Migration From `.snippetfencerules`

You do not need to migrate immediately.

- Existing `.snippetfencerules` files still work.
- Add `snippetfence.yml` when you want per-path policy metadata and severity.
- If both files exist, `snippetfence.yml` is used and the legacy file is ignored.

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
git clone https://github.com/Vaithorat/snippetfence.git
cd snippetfence
npm install
npm test
npm run build
```

## License

MIT
