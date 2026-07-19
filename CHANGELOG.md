# Changelog

## Unreleased

## 1.0.3 - 2026-07-19

### Added

- Added trusted publishing support for npm releases from GitHub Actions.
- Added a release guard that verifies the pushed tag matches the package version before publishing.

### Changed

- Updated the release workflow to use current GitHub Actions versions and Node.js 22.
- Published GitHub repository metadata improvements, including description, homepage, topics, tags, and release entries for prior versions.

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
