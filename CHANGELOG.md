# Changelog

## Unreleased

## 1.1.0 - 2026-07-19

### Added

- Added `snippetfence.yml` config support with defaults, per-path rules, severity, owners, tags, and message metadata.
- Added `snippetfence validate` to report config and fence health issues in human-readable and CI-friendly formats.
- Added `snippetfence add <file> --start <line> --end <line>` to insert fence markers safely with syntax-aware comment styles.
- Added SARIF reporting, report file output, and explicit `--base` / `--head` diff support for CI and pull request workflows.
- Added richer MCP protection metadata including severity, owners, tags, and message fields.

### Changed

- Upgraded `check` output to include policy-aware severities, machine-readable JSON, and configurable failure thresholds via `--fail-on warn|error`.
- Made YAML config take precedence over legacy `.snippetfencerules` while preserving legacy compatibility when YAML is absent.
- Expanded repository validation so config warnings and malformed fence layouts can be surfaced together.
- Normalized machine-readable relative paths across JSON, SARIF, and MCP responses.
- Corrected `validate` file counts to report all scanned files, including clean repos.
- Updated the package test script to build `dist` before running Vitest so CLI integration tests always exercise fresh artifacts.

### Tests

- Added regression coverage for YAML config parsing, ordered policy resolution, SARIF/report-file output, base/head diffing, fail-on severity behavior, validate aggregation, add command insertion, and MCP metadata responses.
- Added sanity coverage for invalid-glob plus unmatched-rule interactions, machine-readable path normalization, `validate --ci` file counts, invalid `add --style`, and overlapping `add` ranges.

### Docs

- Updated the README and implementation plan to document the v1.1 policy-aware workflow, migration path, and release checklist status.

## 1.0.4 - 2026-07-19

### Added

- Added trusted publishing support for npm releases from GitHub Actions.
- Added a release guard that verifies the pushed tag matches the package version before publishing.

### Changed

- Updated the release workflow to use current GitHub Actions versions plus a trusted-publishing-compatible Node.js and npm runtime.
- Published GitHub repository metadata improvements, including description, homepage, topics, tags, and release entries for prior versions.
- Normalized `package.json` repository metadata to exactly match the GitHub repository for npm trusted publishing.

## 1.0.2 - 2026-07-19

### Fixed

- Detect deletion-only edits inside fenced regions during enforcement.
- Make `snippetfence check --all` inspect staged, unstaged, and untracked files.
- Parse unquoted fence reasons in both line-comment and block-comment syntaxes.
- Install Husky hooks with a shebang and executable permissions when possible.
- Report hook protection in `snippetfence doctor` only when SnippetFence is actually wired into the detected hook manager.
- Update existing `lefthook.yaml` files in place instead of creating a separate `lefthook.yml`.
- Pin published pre-commit hook metadata to the package entrypoint and make generated local pre-commit entries use `npx --no-install`.

### Tests

- Added regression coverage for deletion-only diffs, `--all` staged and untracked behavior, unquoted reasons, Husky installation, doctor hook detection, `lefthook.yaml`, and shipped pre-commit metadata.

### Docs

- Updated `README.md`, generated agent instruction files, and contributor docs to match the current enforcement and hook behavior.

## 1.0.1 - 2026-07-19

### Fixed

- Corrected GitHub repository metadata in `package.json` so npm points to the real repository.
- Fixed the README license badge and related links to use `Vaithorat/snippetfence`.
- Kept npm package metadata aligned with the published repository URLs.

## 1.0.0 - 2026-07-19

### Added

- Initial public release of `snippetfence`.
- Fence parsing and repository scanning for protected regions across multiple comment syntaxes.
- Enforcement for protected-region changes via staged git diff checks.
- Hook installation support for Husky, pre-commit, Lefthook, and raw git hooks.
- Agent instruction generation for Claude, AGENTS.md, Cursor, Gemini, Copilot, Windsurf, and Cline.
- MCP server support for real-time protection checks.
- `doctor` command, configuration file support, CI-friendly output flags, and extended CLI coverage.

### Changed

- Bundled build output, docs, tests, and project tooling were included for the first published package.
