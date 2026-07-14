#!/usr/bin/env node

import cac from 'cac';
import pc from 'picocolors';
import * as path from 'node:path';
import { parseFile, parseRepo, resetCounter } from './parser.js';
import { checkStagedChanges } from './enforcer.js';
import { installHook, detectHookManager } from './hook.js';
import { generateInstructions, writeGeneratedFile } from './generate.js';
import { startMcpServer } from './mcp-server.js';

const cli = cac('snippetfence');

cli
  .command('check', 'Check staged changes against protected regions')
  .action(() => {
    const cwd = process.cwd();
    const result = checkStagedChanges(cwd);

    if (result.passed) {
      console.log(pc.green(`✓ No protected region violations (${result.filesChecked} files, ${result.regionsChecked} regions checked)`));
      process.exit(0);
    } else {
      console.error(pc.red(`\n✗ Protected region violations found:\n`));
      for (const v of result.violations) {
        const relPath = path.relative(cwd, v.region.filePath);
        console.error(pc.red(`  ${relPath}:${v.region.startLine}-${v.region.endLine} (modified at line ${v.modifiedLine})`));
        if (v.region.reason) {
          console.error(pc.dim(`    Reason: ${v.region.reason}`));
        }
      }
      console.error(pc.yellow(`\nThese regions are marked with @fence-begin/@fence-end and cannot be modified.`));
      console.error(pc.yellow(`Remove the annotations if this change is intentional.\n`));
      process.exit(1);
    }
  });

cli
  .command('scan <file>', 'Show protected regions in a file')
  .action((file: string) => {
    const filePath = path.resolve(file);
    resetCounter();
    const regions = parseFile(filePath);

    if (regions.length === 0) {
      console.log(pc.dim(`No protected regions found in ${file}`));
      return;
    }

    console.log(pc.cyan(`\nProtected regions in ${file}:\n`));
    for (const r of regions) {
      const reason = r.reason ? pc.dim(` — ${r.reason}`) : '';
      console.log(`  ${pc.green(r.id)}: lines ${r.startLine}-${r.endLine}${reason}`);
    }
    console.log();
  });

cli
  .command('list', 'List all protected regions in the repository')
  .action(() => {
    const cwd = process.cwd();
    resetCounter();
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
    const manager = options.manager as import('./types.js').HookManager | undefined;
    const result = installHook(cwd, manager);

    if (result.success) {
      console.log(pc.green(`✓ ${result.message}`));
    } else {
      console.error(pc.red(`✗ ${result.message}`));
      process.exit(1);
    }
  });

cli
  .command('generate', 'Generate agent-specific protection instructions')
  .option('--format <format>', 'Output format (claude-md, agents-md, cursor-rules, cursor-mdc, gemini-md, copilot)')
  .option('--output <path>', 'Output file path')
  .action((options: { format?: string; output?: string }) => {
    const cwd = process.cwd();
    const format = (options.format ?? 'agents-md') as import('./types.js').GenerateOptions['format'];

    const validFormats = ['claude-md', 'agents-md', 'cursor-rules', 'cursor-mdc', 'gemini-md', 'copilot'];
    if (!validFormats.includes(format)) {
      console.error(pc.red(`Invalid format: ${format}`));
      console.error(pc.dim(`Valid formats: ${validFormats.join(', ')}`));
      process.exit(1);
    }

    const outputPath = writeGeneratedFile(cwd, { format, outputPath: options.output });
    console.log(pc.green(`✓ Generated ${format} instructions at ${path.relative(cwd, outputPath)}`));
  });

cli
  .command('mcp', 'Start MCP server for agent integration')
  .action(async () => {
    await startMcpServer();
  });

cli.help();
cli.version('1.0.0');

cli.parse();
