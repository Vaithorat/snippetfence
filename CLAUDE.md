@AGENTS.md

## Claude Code

- Use plan mode for changes affecting protected regions
- Before modifying any code, check if it is inside a `@fence-begin`/`@fence-end` region using `npx snippetfence scan <file>`
- Reasons after `@fence-begin` may be quoted or unquoted
- If a fenced region must be modified, ask the user for explicit approval first
- Run `npx snippetfence check` before committing to verify no protected regions were violated
- Use `npx snippetfence check --all` when you need to validate staged, unstaged, and untracked changes together
