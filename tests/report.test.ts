import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { buildCheckJson, buildSarifReport } from '../src/report.js';
import type { CheckResult } from '../src/types.js';

describe('report builders', () => {
  it('normalizes relative file paths in JSON and SARIF output', () => {
    const cwd = path.join('C:', 'repo');
    const filePath = path.join(cwd, 'src', 'nested', 'file.ts');
    const result: CheckResult = {
      passed: false,
      failOn: 'error',
      errorCount: 1,
      warningCount: 0,
      filesChecked: 1,
      regionsChecked: 1,
      violations: [
        {
          modifiedLine: 3,
          diffHunk: '@@ -3 +3 @@',
          region: {
            id: 'region-1',
            startLine: 2,
            endLine: 4,
            filePath,
            severity: 'error',
            reason: 'auth',
          },
        },
      ],
    };

    const json = buildCheckJson(result, cwd) as { violations: Array<{ file: string }> };
    const sarif = buildSarifReport(result, cwd) as {
      runs: Array<{
        results: Array<{
          message: { text: string };
          locations: Array<{ physicalLocation: { artifactLocation: { uri: string } } }>;
        }>;
      }>;
    };

    expect(json.violations[0].file).toBe('src/nested/file.ts');
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('src/nested/file.ts');
    expect(sarif.runs[0].results[0].message.text).toContain('src/nested/file.ts:2-4');
  });
});
