import { describe, it, expect } from 'vitest';
import { fairRoundTo100 } from '../src/domain/finance';

describe('fairRoundTo100', () => {
  it('distributes remainders to reach 100', () => {
    const out = fairRoundTo100({ A: 33.3, B: 33.3, C: 33.4 });
    const sum = Object.values(out).reduce((a,b)=>a+b,0);
    expect(sum).toBe(100);
    expect(out.A + out.B + out.C).toBe(100);
  });

  it('handles empty map', () => {
    const out = fairRoundTo100({});
    expect(Object.keys(out).length).toBe(0);
  });
});
