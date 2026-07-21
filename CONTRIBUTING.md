# Contributing to snippetfence

Thank you for your interest in contributing to snippetfence!

## Getting Started

Requires Node 18, 20, or 22.

```bash
git clone https://github.com/Vaithorat/snippetfence.git
cd snippetfence
npm ci
npm test
```

## Development

```bash
npm run dev          # Watch mode
npm test             # Run tests
npm run typecheck    # Type checking
npm run lint         # Linting
npm run build        # Build
```

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run `npm run lint && npm run typecheck && npm test` to validate
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Code Style

- TypeScript strict mode
- ESM modules
- No comments in code (unless requested)
- Follow existing patterns

## Testing

All new features must include tests. Run `npm test` before submitting.

Changes to enforcement, hook installation, or fence parsing should include regression tests.

## Release Process

1. Bump version in `package.json`
2. Update `CHANGELOG.md` with the new version and date
3. Commit: `git commit -m "Prepare v<VERSION>"`
4. Tag: `git tag v<VERSION>`
5. Push: `git push origin main --tags`
6. Publishing is automated via CI when a `v*` tag is pushed

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
