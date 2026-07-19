import { describe, it, expect, afterAll } from 'vitest';
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

function initRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-repo-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'SnippetFence Test'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'pipe' });
  return dir;
}

function commitAll(repoDir: string, message: string): void {
  execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', message], { cwd: repoDir, stdio: 'pipe' });
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
      expect(stdout).toContain('No blocking protected region violations');
    });

    it('supports --dry-run', () => {
      const { stdout, exitCode } = run(['check', '--dry-run'], { cwd: FIXTURES });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No blocking protected region violations');
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

    it('supports --format sarif and --report-file', () => {
      const repoDir = initRepo();
      const reportFile = path.join(repoDir, 'reports', 'snippetfence.sarif');
      fs.writeFileSync(path.join(repoDir, 'protected.ts'), '// @fence-begin auth\nconst value = 1;\n// @fence-end\n');
      commitAll(repoDir, 'initial');
      fs.writeFileSync(path.join(repoDir, 'protected.ts'), '// @fence-begin auth\nconst value = 2;\n// @fence-end\n');
      execFileSync('git', ['add', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });

      const { stdout, exitCode } = run(['check', '--format', 'sarif', '--report-file', reportFile], { cwd: repoDir });
      expect(exitCode).toBe(1);
      const sarif = JSON.parse(stdout);
      expect(sarif.runs[0].results).toHaveLength(1);
      expect(fs.existsSync(reportFile)).toBe(true);
      fs.rmSync(repoDir, { recursive: true, force: true });
    });

    it('supports --fail-on error for warn-level policy', () => {
      const repoDir = initRepo();
      fs.writeFileSync(path.join(repoDir, 'snippetfence.yml'), 'rules:\n  - paths:\n      - "protected.ts"\n    severity: warn\n');
      fs.writeFileSync(path.join(repoDir, 'protected.ts'), '// @fence-begin auth\nconst value = 1;\n// @fence-end\n');
      commitAll(repoDir, 'initial');
      fs.writeFileSync(path.join(repoDir, 'protected.ts'), '// @fence-begin auth\nconst value = 2;\n// @fence-end\n');
      execFileSync('git', ['add', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });

      const { stdout, exitCode } = run(['check', '--format', 'json', '--fail-on', 'error'], { cwd: repoDir });
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.passed).toBe(true);
      expect(json.warningCount).toBeGreaterThan(0);
      fs.rmSync(repoDir, { recursive: true, force: true });
    });

    it('supports --base and --head ref comparisons', () => {
      const repoDir = initRepo();
      fs.writeFileSync(path.join(repoDir, 'protected.ts'), '// @fence-begin auth\nconst value = 1;\n// @fence-end\n');
      commitAll(repoDir, 'initial');
      const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
      fs.writeFileSync(path.join(repoDir, 'protected.ts'), '// @fence-begin auth\nconst value = 2;\n// @fence-end\n');
      commitAll(repoDir, 'updated');
      const headRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

      const { stdout, exitCode } = run(['check', '--format', 'json', '--base', baseRef, '--head', headRef], { cwd: repoDir });
      expect(exitCode).toBe(1);
      const json = JSON.parse(stdout);
      expect(json.violations.length).toBeGreaterThan(0);
      fs.rmSync(repoDir, { recursive: true, force: true });
    });
  });

  describe('validate command', () => {
    it('reports invalid config with a non-zero exit code', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-validate-'));
      fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'unknown: true\n');
      const { stderr, exitCode } = run(['validate'], { cwd: dir });
      expect(exitCode).toBe(2);
      expect(stderr).toContain('Validation issues found');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reports scanned file counts in --ci output for clean repos', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-validate-clean-'));
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'defaults:\n  severity: error\n');
      fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const value = 1;\n');

      const { stdout, exitCode } = run(['validate', '--ci'], { cwd: dir });
      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.passed).toBe(true);
      expect(json.filesChecked).toBe(2);
      expect(json.regionsChecked).toBe(0);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('add command', () => {
    it('inserts fence markers into a file', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-add-'));
      const filePath = path.join(dir, 'sample.ts');
      fs.writeFileSync(filePath, 'const a = 1;\nconst b = 2;\n');

      const { stdout, exitCode } = run(['add', 'sample.ts', '--start', '1', '--end', '2', '--reason', 'auth'], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Added line fence markers');
      const updated = fs.readFileSync(filePath, 'utf-8');
      expect(updated).toContain('// @fence-begin auth');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('rejects invalid fence styles', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-add-style-'));
      fs.writeFileSync(path.join(dir, 'sample.ts'), 'const a = 1;\n');

      const { stderr, exitCode } = run(['add', 'sample.ts', '--start', '1', '--end', '1', '--style', 'weird'], { cwd: dir });
      expect(exitCode).toBe(2);
      expect(stderr).toContain('Invalid fence style');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('rejects overlapping ranges without changing the file', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-cli-add-overlap-'));
      const filePath = path.join(dir, 'sample.ts');
      const original = '// @fence-begin auth\nconst a = 1;\n// @fence-end\nconst b = 2;\n';
      fs.writeFileSync(filePath, original);

      const { stderr, exitCode } = run(['add', 'sample.ts', '--start', '1', '--end', '2'], { cwd: dir });
      expect(exitCode).toBe(2);
      expect(stderr).toContain('overlaps existing protected region');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(original);
      fs.rmSync(dir, { recursive: true, force: true });
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
