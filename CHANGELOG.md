# Changelog

## Unreleased

## 1.3.0 - 2026-07-22

### Added

- Added `generate --check` mode that exits with code 1 when generated instruction files are stale or missing.
- Added managed content markers (`<!-- snippetfence-managed-begin/end -->`) in generated `.md` files so user-written content outside the markers is preserved across regeneration.
- Added `checkGeneratedFile` to the public API for programmatic staleness checks.
- Added clear error message when a base ref is not found during `check --base`, suggesting `fetch-depth: 0`.

### Changed

- `writeGeneratedFile` now wraps managed `.md` formats in markers on first write, preserving surrounding content on subsequent regenerations.
- Non-managed formats (`.cursorrules`, `.windsurfrules`, `.clinerules/snippetfence.md`, `.cursor/rules/protect-fenced.mdc`) continue to overwrite fully.
- Updated README GitHub Actions example to include `fetch-depth: 0`, SARIF upload, `validate`, and `generate --check`.

### Tests

- Added regression coverage for `generate --check` up-to-date, stale, and missing cases.
- Added regression coverage for managed marker round-tripping and non-managed content preservation.
- Added regression coverage for missing base ref returning a failed result.

## 1.2.0 - 2026-07-19

### Added

- Detect deletion of fenced files in staged, working-tree, and ref-based checks (`--diff-filter=D`).
- Detect renamed files that strip fence markers, checked at both old and new paths (`--diff-filter=R` with `-M`).
- Honor `include`/`exclude` config patterns during enforcement — excluded files are now skipped in all check modes.
- Group multiple line edits within the same protected region into a single violation with all affected lines.
- Add `deletedFile` and `modifiedLines` fields to `Violation` type for richer violation reporting.
- JSON and SARIF reports now include `modifiedLines` and `deletedFile` fields.
- CI now runs on both `ubuntu-latest` and `windows-latest`.

### Fixed

- Added `-M` (rename detection) to all internal git diff invocations so renames are consistently detected.
- Renamed file targets no longer produce false full-add violations via path-filtered diffs.
- Rename sources no longer appear as false deleted-file violations when rename detection is active.

### Changed

- Internal diff helpers now use `git diff -M` for consistent rename detection across staged, working-tree, and ref-based checks.
- Internal helper functions (`getStagedDeletedFiles`, `getWorkingTreeDeletedFiles`, `getDeletedFilesBetweenRefs`, `getRenamedFiles`, `getRenamedFilesBetweenRefs`) are no longer exported.
- `checkRenameViolations` now accepts optional `baseRef`/`headRef` parameters for accurate ref-based rename checks.

### Tests

- Added regression coverage for staged and ref-based rename detection (fence stripping, fence preservation, staged renames).
- Added regression coverage for deleted file detection (fenced and unprotected files).
- Added regression coverage for config scope enforcement (excluded files skipped, include-only paths).
- Added regression coverage for violation grouping (multiple edits in one region, separate regions).
- Updated existing tests to account for grouped violations.

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
