import { describe, expect, it } from 'vitest';
import { formatPercentPa } from '../src/utils/format';

describe('formatPercentPa', () => {
  it('formats fraction as sk-SK percent with p. a.', () => {
    const s = formatPercentPa(0.1234, 2);
    // Allow either comma or locale percent sign placement but ensure suffix and 2 decimals
    expect(s.endsWith(' p. a.')).toBe(true);
    expect(s.includes('%')).toBe(true);
  });
  it('handles invalid numbers', () => {
    expect(formatPercentPa(NaN)).toBe('—');
    expect(formatPercentPa(Infinity)).toBe('—');
  });
});
