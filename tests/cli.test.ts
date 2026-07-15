import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const CLI_PATH = path.resolve(__dirname, '..', 'dist', 'cli.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');

function run(args: string[], opts?: { cwd?: string }): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      cwd: opts?.cwd ?? FIXTURES,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 2,
    };
  }
}

describe('CLI integration', () => {
  describe('--help', () => {
    it('shows help text', () => {
      const { stdout, exitCode } = run(['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('snippetfence');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('check');
      expect(stdout).toContain('scan');
      expect(stdout).toContain('list');
      expect(stdout).toContain('init');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('doctor');
      expect(stdout).toContain('mcp');
    });
  });

  describe('--version', () => {
    it('shows version number', () => {
      const { stdout, exitCode } = run(['--version']);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('scan command', () => {
    it('scans a single file', () => {
      const { stdout, exitCode } = run(['scan', 'simple.ts'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Protected regions');
      expect(stdout).toContain('token-validation');
    });

    it('scans a directory', () => {
      const { stdout, exitCode } = run(['scan', '.'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('protected region(s)');
    });

    it('exits 2 for nonexistent path', () => {
      const { exitCode, stderr } = run(['scan', 'nonexistent.txt'], { cwd: FIXTURES });
      expect(exitCode).toBe(2);
      expect(stderr).toContain('Path not found');
    });
  });

  describe('list command', () => {
    it('lists all protected regions', () => {
      const { stdout, exitCode } = run(['list'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('protected region(s)');
      expect(stdout).toContain('token-validation');
    });

    it('supports --root', () => {
      const { stdout, exitCode } = run(['list', '--root', FIXTURES]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('protected region(s)');
    });
  });

  describe('check command', () => {
    it('shows no violations when nothing staged', () => {
      const { stdout, exitCode } = run(['check'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No protected region violations');
    });

    it('supports --dry-run', () => {
      const { stdout, exitCode } = run(['check', '--dry-run'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No protected region violations');
    });

    it('supports --ci JSON output', () => {
      const { stdout, exitCode } = run(['check', '--ci'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty('passed');
      expect(json).toHaveProperty('violations');
      expect(json).toHaveProperty('filesChecked');
      expect(json).toHaveProperty('regionsChecked');
    });
  });

  describe('generate command', () => {
    let tmpDir: string;

    beforeAll(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-test-'));
    });

    afterAll(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('generates AGENTS.md by default', () => {
      const { stdout, exitCode } = run(['generate', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generated');
      const agentsMd = path.join(FIXTURES, 'AGENTS.md');
      expect(fs.existsSync(agentsMd)).toBe(true);
      const content = fs.readFileSync(agentsMd, 'utf-8');
      expect(content).toContain('@fence-begin');
      fs.unlinkSync(agentsMd);
    });

    it('generates CLAUDE.md', () => {
      const { stdout, exitCode } = run(['generate', '--format', 'claude-md', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const f = path.join(FIXTURES, 'CLAUDE.md');
      expect(fs.existsSync(f)).toBe(true);
      fs.unlinkSync(f);
    });

    it('generates GEMINI.md', () => {
      const { stdout, exitCode } = run(['generate', '--format', 'gemini-md', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const geminiMd = path.join(FIXTURES, 'GEMINI.md');
      expect(fs.existsSync(geminiMd)).toBe(true);
      const content = fs.readFileSync(geminiMd, 'utf-8');
      expect(content).toContain('Gemini Code Protection');
      fs.unlinkSync(geminiMd);
    });

    it('generates .windsurfrules', () => {
      const { exitCode } = run(['generate', '--format', 'windsurf', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const f = path.join(FIXTURES, '.windsurfrules');
      expect(fs.existsSync(f)).toBe(true);
      fs.unlinkSync(f);
    });

    it('generates .clinerules/snippetfence.md', () => {
      const { exitCode } = run(['generate', '--format', 'cline', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const clinePath = path.join(FIXTURES, '.clinerules', 'snippetfence.md');
      expect(fs.existsSync(clinePath)).toBe(true);
      const content = fs.readFileSync(clinePath, 'utf-8');
      expect(content).toContain('SnippetFence Rules');
      fs.rmSync(path.join(FIXTURES, '.clinerules'), { recursive: true, force: true });
    });

    it('generates .github/copilot-instructions.md', () => {
      const { exitCode } = run(['generate', '--format', 'copilot', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const f = path.join(FIXTURES, '.github', 'copilot-instructions.md');
      expect(fs.existsSync(f)).toBe(true);
      fs.rmSync(path.join(FIXTURES, '.github'), { recursive: true, force: true });
    });

    it('generates .cursorrules', () => {
      const { exitCode } = run(['generate', '--format', 'cursor-rules', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const f = path.join(FIXTURES, '.cursorrules');
      expect(fs.existsSync(f)).toBe(true);
      fs.unlinkSync(f);
    });

    it('generates .cursor/rules/protect-fenced.mdc', () => {
      const { exitCode } = run(['generate', '--format', 'cursor-mdc', '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      const f = path.join(FIXTURES, '.cursor', 'rules', 'protect-fenced.mdc');
      expect(fs.existsSync(f)).toBe(true);
      fs.rmSync(path.join(FIXTURES, '.cursor'), { recursive: true, force: true });
    });

    it('generates to custom output path', () => {
      const outPath = path.join(tmpDir, 'custom-output.md');
      const { exitCode } = run(['generate', '--format', 'claude-md', '--output', outPath, '--root', FIXTURES], { cwd: tmpDir });
      expect(exitCode).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);
    });

    it('exits 2 for invalid format', () => {
      const { exitCode, stderr } = run(['generate', '--format', 'invalid'], { cwd: FIXTURES });
      expect(exitCode).toBe(2);
      expect(stderr).toContain('Invalid format');
    });
  });

  describe('doctor command', () => {
    it('shows doctor output', () => {
      const { stdout, exitCode } = run(['doctor']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('SnippetFence Doctor');
      expect(stdout).toContain('Git repository detected');
    });

    it('supports --ci JSON output', () => {
      const { stdout, exitCode } = run(['doctor', '--ci']);
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json).toHaveProperty('gitRepo');
      expect(json).toHaveProperty('hookInstalled');
      expect(json).toHaveProperty('hookManager');
      expect(json).toHaveProperty('fencesValid');
      expect(json).toHaveProperty('protectedRegions');
      expect(json).toHaveProperty('warnings');
    });

    it('supports --root', () => {
      const { stdout, exitCode } = run(['doctor', '--root', FIXTURES]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('SnippetFence Doctor');
    });
  });

  describe('init command', () => {
    it('exits 2 for invalid manager', () => {
      const { exitCode, stderr } = run(['init', '--manager', 'invalid']);
      expect(exitCode).toBe(2);
      expect(stderr).toContain('Invalid hook manager');
    });
  });
});
