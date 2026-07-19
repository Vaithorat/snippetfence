# Contributing to snippetfence

Thank you for your interest in contributing to snippetfence!

## Getting Started

```bash
git clone https://github.com/Vaithorat/snippetfence.git
cd snippetfence
npm install
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
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- TypeScript strict mode
- ESM modules
- No comments in code (unless requested)
- Follow existing patterns

## Testing

All new features must include tests. Run `npm test` before submitting.

Changes to enforcement, hook installation, or fence parsing should include regression tests.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
