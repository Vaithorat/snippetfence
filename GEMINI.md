@AGENTS.md

## Gemini CLI

- Protected regions are marked with `@fence-begin`/`@fence-end` annotations
- Reasons after `@fence-begin` may be quoted or unquoted
- Do not modify code inside these regions without explicit user approval
- Run `npx snippetfence check` before committing
- Use `npx snippetfence check --all` to validate staged, unstaged, and untracked changes together
- Use `npx snippetfence list` to see all protected regions in the project
