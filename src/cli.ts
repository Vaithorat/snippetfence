#!/usr/bin/env node

import cac from 'cac';
import pc from 'picocolors';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { addFence } from './add.js';
import { parseFile, parseRepo } from './parser.js';
import { checkAllChanges, checkRefChanges, checkStagedChanges } from './enforcer.js';
import { installHook } from './hook.js';
import { writeGeneratedFile, checkGeneratedFile } from './generate.js';
import { runDoctor } from './doctor.js';
import { validateRepository } from './validate.js';
import { buildCheckJson, buildSarifReport } from './report.js';
import { VERSION } from './version.js';
import type { GenerateOptions, HookManager, PolicySeverity } from './types.js';

const cli = cac('snippetfence');

const EXIT_OK = 0;
const EXIT_VIOLATIONS = 1;
const EXIT_ERROR = 2;

cli
  .command('check', 'Check changes against protected regions')
  .option('--dry-run', 'Show violations without failing (preview mode)')
  .option('--root <path>', 'Root directory to scan from')
  .option('--all', 'Check staged, unstaged, and untracked changes')
  .option('--ci', 'Output machine-readable JSON for CI')
  .option('--format <format>', 'Output format (text, json, sarif)')
  .option('--report-file <path>', 'Write the selected report output to a file')
  .option('--base <git-ref>', 'Base git ref for diff comparison')
  .option('--head <git-ref>', 'Head git ref for diff comparison (default: HEAD)')
  .option('--fail-on <severity>', 'Failure threshold (warn or error)')
  .action((options: {
    dryRun?: boolean;
    root?: string;
    all?: boolean;
    ci?: boolean;
    format?: string;
    reportFile?: string;
    base?: string;
    head?: string;
    failOn?: string;
  }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();
    const failOn = getFailOn(options.failOn);
    const format = getCheckFormat(options.format, options.ci);

    if (options.base) {
      try {
        execFileSync('git', ['rev-parse', '--verify', options.base], { cwd, stdio: 'pipe' });
      } catch {
        console.error(pc.red(`Base ref "${options.base}" not found. Ensure full clone depth (fetch-depth: 0).`));
        process.exit(EXIT_ERROR);
      }
    }

    const result = options.base
      ? checkRefChanges(cwd, options.base, options.head ?? 'HEAD', { failOn })
      : options.all
        ? checkAllChanges(cwd, { failOn })
        : checkStagedChanges(cwd, { failOn });

    if (format === 'json') {
      const output = JSON.stringify(buildCheckJson(result, cwd), null, 2);
      if (options.reportFile) {
        writeReportFile(options.reportFile, output);
      }
      console.log(output);
      process.exit(result.passed || options.dryRun ? EXIT_OK : EXIT_VIOLATIONS);
    }

    if (format === 'sarif') {
      const output = JSON.stringify(buildSarifReport(result, cwd), null, 2);
      if (options.reportFile) {
        writeReportFile(options.reportFile, output);
      }
      console.log(output);
      process.exit(result.passed || options.dryRun ? EXIT_OK : EXIT_VIOLATIONS);
    }

    const output = formatTextCheckResult(result, cwd);
    if (options.reportFile) {
      writeReportFile(options.reportFile, output);
    }

    const stream = result.passed || options.dryRun ? process.stdout : process.stderr;
    stream.write(`${output}\n`);
    process.exit(result.passed || options.dryRun ? EXIT_OK : EXIT_VIOLATIONS);
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
        for (const region of regions) {
          const relPath = path.relative(targetPath, region.filePath);
          console.log(`  ${pc.green(region.id)}: ${pc.white(relPath)}:${region.startLine}-${region.endLine}${formatRegionSuffix(region)}`);
        }
        console.log();
      } else {
        const regions = parseFile(targetPath);

        if (regions.length === 0) {
          console.log(pc.dim(`No protected regions found in ${target}`));
          return;
        }

        console.log(pc.cyan(`\nProtected regions in ${target}:\n`));
        for (const region of regions) {
          console.log(`  ${pc.green(region.id)}: lines ${region.startLine}-${region.endLine}${formatRegionSuffix(region)}`);
        }
        console.log();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`Error scanning ${target}: ${message}`));
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
    for (const region of regions) {
      const relPath = path.relative(cwd, region.filePath);
      console.log(`  ${pc.green(region.id)}: ${pc.white(relPath)}:${region.startLine}-${region.endLine}${formatRegionSuffix(region)}`);
    }
    console.log();
  });

cli
  .command('validate', 'Validate config and fence annotations')
  .option('--ci', 'Output machine-readable JSON')
  .option('--root <path>', 'Root directory to scan from')
  .action((options: { ci?: boolean; root?: string }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();
    const result = validateRepository(cwd);

    if (options.ci) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? EXIT_OK : EXIT_ERROR);
    }

    if (result.passed) {
      console.log(pc.green(`✓ Validation passed (${result.filesChecked} files, ${result.regionsChecked} regions checked)`));
      return;
    }

    console.error(pc.red(`\n✗ Validation issues found:\n`));
    for (const issue of result.issues) {
      const relPath = path.relative(cwd, issue.filePath);
      const location = issue.line ? `${relPath}:${issue.line}` : relPath;
      const color = issue.level === 'error' ? pc.red : pc.yellow;
      console.error(color(`  [${issue.source}/${issue.code}] ${location} - ${issue.message}`));
    }
    console.error();
    process.exit(EXIT_ERROR);
  });

cli
  .command('add <file>', 'Add fence markers around a line range')
  .option('--start <line>', 'Start line number')
  .option('--end <line>', 'End line number')
  .option('--reason <text>', 'Optional reason text')
  .option('--style <style>', 'Marker style (auto, line, block)')
  .action((file: string, options: { start?: string; end?: string; reason?: string; style?: string }) => {
    const startLine = Number(options.start);
    const endLine = Number(options.end);
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
      console.error(pc.red('Both --start and --end must be provided as whole numbers'));
      process.exit(EXIT_ERROR);
    }

    try {
      const result = addFence(file, {
        startLine,
        endLine,
        reason: options.reason,
        style: getAddStyle(options.style),
      });
      console.log(pc.green(`✓ Added ${result.style} fence markers to ${path.relative(process.cwd(), result.filePath)}`));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`Error adding fence markers: ${message}`));
      process.exit(EXIT_ERROR);
    }
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
  .option('--check', 'Check if generated file is up-to-date (exit 1 if stale)')
  .action((options: { format?: string; output?: string; root?: string; check?: boolean }) => {
    const cwd = options.root ? path.resolve(options.root) : process.cwd();
    const format = (options.format ?? 'agents-md') as GenerateOptions['format'];

    const validFormats: GenerateOptions['format'][] = ['claude-md', 'agents-md', 'cursor-rules', 'cursor-mdc', 'gemini-md', 'copilot', 'windsurf', 'cline'];
    if (!validFormats.includes(format)) {
      console.error(pc.red(`Invalid format: ${format}`));
      console.error(pc.dim(`Valid formats: ${validFormats.join(', ')}`));
      process.exit(EXIT_ERROR);
    }

    if (options.check) {
      const { upToDate, outputPath } = checkGeneratedFile(cwd, { format, outputPath: options.output });
      if (upToDate) {
        console.log(pc.green(`✓ Generated ${format} instructions are up-to-date at ${path.relative(cwd, outputPath)}`));
        process.exit(EXIT_OK);
      } else {
        console.error(pc.red(`✗ Generated ${format} instructions are stale at ${path.relative(cwd, outputPath)}`));
        console.error(pc.dim('Run `snippetfence generate` to update.'));
        process.exit(EXIT_VIOLATIONS);
      }
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
        warnings: result.warnings.map(warning => ({
          type: warning.type,
          message: warning.message,
          line: warning.line,
          file: path.relative(cwd, warning.filePath),
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
      console.log(pc.yellow('  ⚠ No pre-commit hook installed - run `snippetfence init`'));
    }

    console.log(pc.cyan(`  ℹ ${result.protectedRegions} protected region(s) found`));

    if (result.fencesValid) {
      console.log(pc.green('  ✓ All fence annotations are well-formed'));
    } else {
      console.log(pc.yellow(`  ⚠ ${result.warnings.length} warning(s) in fence annotations:\n`));
      for (const warning of result.warnings) {
        const relPath = path.relative(cwd, warning.filePath);
        const icon = warning.type === 'nested' ? 'nested  ' : warning.type === 'unclosed' ? 'unclosed' : 'typo    ';
        console.log(pc.yellow(`    [${icon}] ${relPath}:${warning.line} - ${warning.message}`));
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

function getCheckFormat(format: string | undefined, ci: boolean | undefined): 'text' | 'json' | 'sarif' {
  const resolved = format ?? (ci ? 'json' : 'text');
  if (resolved !== 'text' && resolved !== 'json' && resolved !== 'sarif') {
    console.error(pc.red(`Invalid report format: ${resolved}`));
    process.exit(EXIT_ERROR);
  }
  return resolved;
}

function getFailOn(value: string | undefined): PolicySeverity {
  const resolved = value ?? 'error';
  if (resolved !== 'warn' && resolved !== 'error') {
    console.error(pc.red(`Invalid fail-on severity: ${resolved}`));
    process.exit(EXIT_ERROR);
  }
  return resolved;
}

function getAddStyle(value: string | undefined): 'auto' | 'line' | 'block' {
  const resolved = value ?? 'auto';
  if (resolved !== 'auto' && resolved !== 'line' && resolved !== 'block') {
    console.error(pc.red(`Invalid fence style: ${resolved}`));
    process.exit(EXIT_ERROR);
  }
  return resolved;
}

function writeReportFile(filePath: string, content: string): void {
  const absPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
}

function formatTextCheckResult(result: ReturnType<typeof checkStagedChanges>, cwd: string): string {
  if (result.passed) {
    return pc.green(`✓ No blocking protected region violations (${result.filesChecked} files, ${result.regionsChecked} regions checked, fail-on=${result.failOn})`);
  }

  const lines = [pc.red('\n✗ Protected region violations found:\n')];
  for (const violation of result.violations) {
    const relPath = path.relative(cwd, violation.region.filePath);
    if (violation.deletedFile) {
      lines.push(pc.red(`  [${violation.region.severity}] ${relPath}:${violation.region.startLine}-${violation.region.endLine} (file deleted)`));
    } else {
      lines.push(pc.red(`  [${violation.region.severity}] ${relPath}:${violation.region.startLine}-${violation.region.endLine} (modified at line ${violation.modifiedLine})`));
    }
    if (violation.region.reason) {
      lines.push(pc.dim(`    Reason: ${violation.region.reason}`));
    }
    if (violation.region.message) {
      lines.push(pc.dim(`    Message: ${violation.region.message}`));
    }
    if (violation.region.owners?.length) {
      lines.push(pc.dim(`    Owners: ${violation.region.owners.join(', ')}`));
    }
    if (violation.region.tags?.length) {
      lines.push(pc.dim(`    Tags: ${violation.region.tags.join(', ')}`));
    }
    if (violation.diffHunk) {
      lines.push(pc.dim('    Diff hunk:'));
      for (const line of violation.diffHunk.split('\n')) {
        lines.push(pc.dim(`      ${line}`));
      }
    }
  }
  lines.push(pc.yellow(`\nBlocking threshold: ${result.failOn}`));
  lines.push(pc.yellow('These regions are marked with @fence-begin/@fence-end and cannot be modified.'));
  lines.push(pc.yellow('Remove the annotations if this change is intentional.'));
  return lines.join('\n');
}

function formatRegionSuffix(region: ReturnType<typeof parseFile>[number]): string {
  const parts: string[] = [];
  if (region.reason) {
    parts.push(region.reason);
  }
  parts.push(`severity=${region.severity}`);
  if (region.owners?.length) {
    parts.push(`owners=${region.owners.join(',')}`);
  }
  if (region.tags?.length) {
    parts.push(`tags=${region.tags.join(',')}`);
  }
  if (region.message) {
    parts.push(`message=${region.message}`);
  }
  return parts.length > 0 ? pc.dim(` - ${parts.join(' | ')}`) : '';
}
