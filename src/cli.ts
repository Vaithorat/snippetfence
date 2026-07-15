#!/usr/bin/env node

import cac from 'cac';
import pc from 'picocolors';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseFile, parseRepo } from './parser.js';
import { checkStagedChanges, checkWorkingTreeChanges } from './enforcer.js';
import { installHook } from './hook.js';
import { writeGeneratedFile } from './generate.js';
import { runDoctor } from './doctor.js';
import { VERSION } from './version.js';
import type { HookManager, GenerateOptions } from './types.js';

const cli = cac('snippetfence');

const EXIT_OK = 0;
const EXIT_VIOLATIONS = 1;
const EXIT_ERROR = 2;

cli
  .command('check', 'Check changes against protected regions')
  .option('--dry-run', 'Show violations without failing (preview mode)')
  .option('--root <path>', 'Root directory to scan from')
  .option('--all', 'Check working tree changes (not just staged)')
  .option('--ci', 'Output machine-readable JSON for CI')
  .action((options: { dryRun?: boolean; root?: string; all?: boolean; ci?: boolean }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();

    const result = options.all
      ? checkWorkingTreeChanges(cwd)
      : checkStagedChanges(cwd);

    if (options.ci) {
      const output = {
        passed: result.passed,
        violations: result.violations.map(v => ({
          file: path.relative(cwd, v.region.filePath),
          region: v.region.id,
          startLine: v.region.startLine,
          endLine: v.region.endLine,
          modifiedLine: v.modifiedLine,
          reason: v.region.reason,
          diffHunk: v.diffHunk,
        })),
        filesChecked: result.filesChecked,
        regionsChecked: result.regionsChecked,
      };
      console.log(JSON.stringify(output, null, 2));
      process.exit(result.passed ? EXIT_OK : EXIT_VIOLATIONS);
    }

    if (result.passed) {
      console.log(pc.green(`✓ No protected region violations (${result.filesChecked} files, ${result.regionsChecked} regions checked)`));
      process.exit(EXIT_OK);
    } else {
      console.error(pc.red(`\n✗ Protected region violations found:\n`));
      for (const v of result.violations) {
        const relPath = path.relative(cwd, v.region.filePath);
        console.error(pc.red(`  ${relPath}:${v.region.startLine}-${v.region.endLine} (modified at line ${v.modifiedLine})`));
        if (v.region.reason) {
          console.error(pc.dim(`    Reason: ${v.region.reason}`));
        }
        if (v.diffHunk) {
          console.error(pc.dim(`    Diff hunk:`));
          for (const line of v.diffHunk.split('\n')) {
            console.error(pc.dim(`      ${line}`));
          }
        }
      }
      console.error(pc.yellow(`\nThese regions are marked with @fence-begin/@fence-end and cannot be modified.`));
      console.error(pc.yellow(`Remove the annotations if this change is intentional.\n`));
      process.exit(options.dryRun ? EXIT_OK : EXIT_VIOLATIONS);
    }
  });

cli
  .command('scan <target>', 'Show protected regions in a file or directory')
  .action((target: string) => {
    const targetPath = path.resolve(target);

    try {
      const stat = fs.statSync(targetPath, { throwIfNoEntry: false });

      if (!stat) {
        console.error(pc.red(`Path not found: ${target}`));
        process.exit(EXIT_ERROR);
      }

      if (stat.isDirectory()) {
        const regions = parseRepo(targetPath);

        if (regions.length === 0) {
          console.log(pc.dim(`No protected regions found in ${target}`));
          return;
        }

        console.log(pc.cyan(`\nFound ${regions.length} protected region(s) in ${target}:\n`));
        for (const r of regions) {
          const relPath = path.relative(targetPath, r.filePath);
          const reason = r.reason ? pc.dim(` — ${r.reason}`) : '';
          console.log(`  ${pc.green(r.id)}: ${pc.white(relPath)}:${r.startLine}-${r.endLine}${reason}`);
        }
        console.log();
      } else {
        const regions = parseFile(targetPath);

        if (regions.length === 0) {
          console.log(pc.dim(`No protected regions found in ${target}`));
          return;
        }

        console.log(pc.cyan(`\nProtected regions in ${target}:\n`));
        for (const r of regions) {
          const reason = r.reason ? pc.dim(` — ${r.reason}`) : '';
          console.log(`  ${pc.green(r.id)}: lines ${r.startLine}-${r.endLine}${reason}`);
        }
        console.log();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`Error scanning ${target}: ${msg}`));
      process.exit(EXIT_ERROR);
    }
  });

cli
  .command('list', 'List all protected regions in the repository')
  .option('--root <path>', 'Root directory to scan from')
  .action((options: { root?: string }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();
    const regions = parseRepo(cwd);

    if (regions.length === 0) {
      console.log(pc.dim('No protected regions found in this repository'));
      return;
    }

    console.log(pc.cyan(`\nFound ${regions.length} protected region(s):\n`));
    for (const r of regions) {
      const relPath = path.relative(cwd, r.filePath);
      const reason = r.reason ? pc.dim(` — ${r.reason}`) : '';
      console.log(`  ${pc.green(r.id)}: ${pc.white(relPath)}:${r.startLine}-${r.endLine}${reason}`);
    }
    console.log();
  });

cli
  .command('init', 'Install pre-commit hook')
  .option('--manager <manager>', 'Hook manager to use (husky, pre-commit, lefthook, raw)')
  .action((options: { manager?: string }) => {
    const cwd = process.cwd();
    const validManagers: HookManager[] = ['husky', 'pre-commit', 'lefthook', 'raw'];
    const manager = options.manager as HookManager | undefined;
    if (manager && !validManagers.includes(manager)) {
      console.error(pc.red(`Invalid hook manager: ${manager}`));
      console.error(pc.dim(`Valid managers: ${validManagers.join(', ')}`));
      process.exit(EXIT_ERROR);
    }
    const result = installHook(cwd, manager);

    if (result.success) {
      console.log(pc.green(`✓ ${result.message}`));
    } else {
      console.error(pc.red(`✗ ${result.message}`));
      process.exit(EXIT_ERROR);
    }
  });

cli
  .command('generate', 'Generate agent-specific protection instructions')
  .option('--format <format>', 'Output format (claude-md, agents-md, cursor-rules, cursor-mdc, gemini-md, copilot, windsurf, cline)')
  .option('--output <path>', 'Output file path')
  .option('--root <path>', 'Root directory to scan from')
  .action((options: { format?: string; output?: string; root?: string }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();
    const format = (options.format ?? 'agents-md') as GenerateOptions['format'];

    const validFormats: GenerateOptions['format'][] = ['claude-md', 'agents-md', 'cursor-rules', 'cursor-mdc', 'gemini-md', 'copilot', 'windsurf', 'cline'];
    if (!validFormats.includes(format)) {
      console.error(pc.red(`Invalid format: ${format}`));
      console.error(pc.dim(`Valid formats: ${validFormats.join(', ')}`));
      process.exit(EXIT_ERROR);
    }

    const outputPath = writeGeneratedFile(cwd, { format, outputPath: options.output });
    console.log(pc.green(`✓ Generated ${format} instructions at ${path.relative(cwd, outputPath)}`));
  });

cli
  .command('doctor', 'Validate setup and fence annotations')
  .option('--ci', 'Output machine-readable JSON for CI')
  .option('--root <path>', 'Root directory to scan from')
  .action((options: { ci?: boolean; root?: string }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();
    const result = runDoctor(cwd);

    if (options.ci) {
      const output = {
        gitRepo: result.gitRepo,
        hookInstalled: result.hookInstalled,
        hookManager: result.hookManager,
        fencesValid: result.fencesValid,
        protectedRegions: result.protectedRegions,
        warnings: result.warnings.map(w => ({
          type: w.type,
          message: w.message,
          line: w.line,
          file: path.relative(cwd, w.filePath),
        })),
      };
      console.log(JSON.stringify(output, null, 2));
      process.exit(result.fencesValid ? EXIT_OK : EXIT_ERROR);
    }

    console.log(pc.cyan('\nSnippetFence Doctor\n'));

    if (result.gitRepo) {
      console.log(pc.green('  ✓ Git repository detected'));
    } else {
      console.log(pc.red('  ✗ Not a git repository'));
    }

    if (result.hookInstalled) {
      console.log(pc.green(`  ✓ Pre-commit hook installed (${result.hookManager})`));
    } else {
      console.log(pc.yellow('  ⚠ No pre-commit hook installed — run `snippetfence init`'));
    }

    console.log(pc.cyan(`  ℹ ${result.protectedRegions} protected region(s) found`));

    if (result.fencesValid) {
      console.log(pc.green('  ✓ All fence annotations are well-formed'));
    } else {
      console.log(pc.yellow(`  ⚠ ${result.warnings.length} warning(s) in fence annotations:\n`));
      for (const w of result.warnings) {
        const relPath = path.relative(cwd, w.filePath);
        const icon = w.type === 'nested' ? 'nested  ' : w.type === 'unclosed' ? 'unclosed' : 'typo    ';
        console.log(pc.yellow(`    [${icon}] ${relPath}:${w.line} — ${w.message}`));
      }
    }

    console.log();
  });

cli
  .command('mcp', 'Start MCP server for agent integration')
  .action(async () => {
    const { startMcpServer } = await import('./mcp-server.js');
    await startMcpServer();
  });

cli.help();
cli.version(VERSION);

cli.parse();
