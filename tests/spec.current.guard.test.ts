import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { OVERWEIGHT_START, OVERWEIGHT_K, HHI_THRESHOLD, HHI_K, DYNCRYPTO_SUM_START, DYNCRYPTO_K } from '../src/domain/risk';

function md(path: string){
  return readFileSync(path, 'utf8');
}

describe('spec-current-v1.md guard', () => {
  const specPath = join(process.cwd(), 'docs', 'spec-current-v1.md');
  const text = md(specPath);

  it('documents overweight threshold and coefficient', () => {
    // e.g., "overweight ... 35%" and "koef. 8"
    expect(text).toMatch(new RegExp(String(Math.round(OVERWEIGHT_START*100)) + '%'));
    expect(text).toMatch(new RegExp(String(OVERWEIGHT_K)));
  });

  it('documents HHI threshold and coefficient', () => {
    // e.g., "HHI 0.18" and "koef. 12"
    expect(text).toContain(String(HHI_THRESHOLD));
    expect(text).toMatch(new RegExp(String(HHI_K)));
  });

  it('documents dyn+crypto threshold and coefficient', () => {
    // e.g., "dyn+crypto 45%" and "koef. 15"
    expect(text).toMatch(new RegExp(String(Math.round(DYNCRYPTO_SUM_START*100)) + '%'));
    expect(text).toMatch(new RegExp(String(DYNCRYPTO_K)));
  });

  it('documents score formulas for Legacy and Current', () => {
    // Look for textual formulas in the spec
    expect(text).toMatch(/Current:\s*er\s*\/\s*risk/i);
    expect(text).toMatch(/Legacy:\s*\(er\s*[·*]\s*100\)\s*\/\s*min\(10,\s*risk\)/i);
  });

  it('contains exactly five audit rows with expected names', () => {
    const expected = [
      'Golden A (60/20/10/5/5)',
      'Golden B (40/20/20/10/10)',
      'Golden C (25/20/15/10/20/10)',
      'Real-1 (Conservative tilt)',
      'Real-2 (Aggressive tilt)',
    ];
    const rows = Array.from(text.matchAll(/^\|\s*(.+?)\s*\|\s*\d/isgm)).map(m => m[1]);
    // Ensure all expected are present
    expected.forEach(name => expect(text).toMatch(new RegExp(`^\\|\\s*${name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1")}\\s*\\|`, 'm')));
    // And count total occurrences of rows that start with these names is 5
    const count = expected.reduce((acc, name) => acc + (text.match(new RegExp(`^\\|\\s*${name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1")}\\s*\\|`, 'mg')) || []).length, 0);
    expect(count).toBe(5);
  });
});
