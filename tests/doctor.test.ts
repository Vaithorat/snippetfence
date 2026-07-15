import { describe, it, expect } from 'vitest';
import { runDoctor } from '../src/doctor.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

describe('runDoctor', () => {
  it('returns a valid DoctorResult', () => {
    const result = runDoctor(PROJECT_ROOT);
    expect(result).toHaveProperty('gitRepo');
    expect(result).toHaveProperty('hookInstalled');
    expect(result).toHaveProperty('hookManager');
    expect(result).toHaveProperty('fencesValid');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('protectedRegions');
  });

  it('detects git repo', () => {
    const result = runDoctor(PROJECT_ROOT);
    expect(result.gitRepo).toBe(true);
  });

  it('reports protected regions count', () => {
    const result = runDoctor(PROJECT_ROOT);
    expect(result.protectedRegions).toBeGreaterThan(0);
  });

  it('returns warnings array', () => {
    const result = runDoctor(PROJECT_ROOT);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
