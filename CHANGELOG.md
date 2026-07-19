# Changelog

## Unreleased

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
