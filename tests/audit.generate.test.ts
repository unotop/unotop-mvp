import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { getAssetsByScenario } from '../src/domain/assets';
import { computeRisk as computeRiskCurrent } from '../src/domain/risk';
import { computeRiskLegacy } from '../src/domain/riskLegacy';

type Mix = Record<string, number>;

function norm(m: Mix) {
  const s = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  const o: Mix = {};
  for (const k in m) o[k] = m[k] / s;
  return o;
}

function expectedReturn(weights: Mix, assets: any) {
  let er = 0;
  for (const k in weights) er += (weights[k] || 0) * assets[k].expReturn;
  return er;
}

function fvMonthly(oneTime: number, monthly: number, years: number, rPa: number) {
  const n = years * 12;
  const r = rPa / 12;
  let v = oneTime;
  for (let m = 1; m <= n; m++) v = v * (1 + r) + monthly;
  return v;
}

function runCase(name: string, mix: Mix) {
  const assetsL = getAssetsByScenario('base' as any, 'legacy');
  const assetsC = getAssetsByScenario('base' as any, 'current');
  const nL = norm(mix);
  const nC = norm(mix);
  const rL = computeRiskLegacy(nL, assetsL).raw;
  const rC = computeRiskCurrent(nC, assetsC).raw;
  const erL = expectedReturn(nL, assetsL);
  const erC = expectedReturn(nC, assetsC);
  const fvL = fvMonthly(10000, 300, 10, erL);
  const fvC = fvMonthly(10000, 300, 10, erC);
  const scoreL = (erL * 100) / Math.min(10, rL || 1);
  const scoreC = erC / (rC || 1);
  return { name, riskL: rL, riskC: rC, erL, erC, fvL, fvC, scoreL, scoreC };
}

describe('Audit generator (writes audit.json)', () => {
  it('computes metrics, writes audit.json and updates docs table', () => {
    const cases: Array<{ name: string; mix: Mix }> = [
      {
        name: 'Golden A (60/20/10/5/5)',
        mix: {
          'ETF (svet – aktívne)': 60,
          'Zlato (fyzické)': 20,
          'Krypto (BTC/ETH)': 10,
          'Dynamické riadenie': 5,
          'Garantovaný dlhopis 7,5% p.a.': 5,
          'Hotovosť/rezerva': 0,
          'Reality (komerčné)': 0,
        },
      },
      {
        name: 'Golden B (40/20/20/10/10)',
        mix: {
          'ETF (svet – aktívne)': 40,
          'Zlato (fyzické)': 20,
          'Krypto (BTC/ETH)': 20,
          'Dynamické riadenie': 10,
          'Garantovaný dlhopis 7,5% p.a.': 10,
          'Hotovosť/rezerva': 0,
          'Reality (komerčné)': 0,
        },
      },
      {
        name: 'Golden C (25/20/15/10/20/10)',
        mix: {
          'ETF (svet – aktívne)': 25,
          'Zlato (fyzické)': 20,
          'Krypto (BTC/ETH)': 15,
          'Dynamické riadenie': 10,
          'Garantovaný dlhopis 7,5% p.a.': 20,
          'Hotovosť/rezerva': 10,
          'Reality (komerčné)': 0,
        },
      },
      {
        name: 'Real-1 (Conservative tilt)',
        mix: {
          'ETF (svet – aktívne)': 20,
          'Zlato (fyzické)': 25,
          'Krypto (BTC/ETH)': 5,
          'Dynamické riadenie': 5,
          'Garantovaný dlhopis 7,5% p.a.': 35,
          'Hotovosť/rezerva': 10,
          'Reality (komerčné)': 0,
        },
      },
      {
        name: 'Real-2 (Aggressive tilt)',
        mix: {
          'ETF (svet – aktívne)': 45,
          'Zlato (fyzické)': 10,
          'Krypto (BTC/ETH)': 20,
          'Dynamické riadenie': 15,
          'Garantovaný dlhopis 7,5% p.a.': 5,
          'Hotovosť/rezerva': 5,
          'Reality (komerčné)': 0,
        },
      },
    ];
    const out = cases.map((c) => runCase(c.name, c.mix));
    const path = join(process.cwd(), 'audit.json');
    writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
    // Also update docs/spec-current-v1.md table rows
    const docPath = join(process.cwd(), 'docs', 'spec-current-v1.md');
    try {
      let md = readFileSync(docPath, 'utf8');
      function fmt(n: number, d = 2) {
        return Number.isFinite(n) ? n.toFixed(d) : '—';
      }
      function fmtInt(n: number) {
        return Number.isFinite(n) ? Math.round(n).toString() : '—';
      }
      const rowMap: Record<string, string> = {};
      for (const r of out) {
        const name = r.name;
        const line = `| ${name} | ${fmt(r.riskL)} | ${fmt(r.riskC)} | ${fmt(r.erL)} | ${fmt(r.erC)} | ${fmtInt(r.fvL)} | ${fmtInt(r.fvC)} | ${fmt(r.scoreL)} | ${fmt(r.scoreC)} |`;
        rowMap[name] = line;
      }
      // Replace each known row preserving trailing comment text
      for (const name of Object.keys(rowMap)) {
        const rx = new RegExp(`^\\|\\s*${name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1')}\\s*\\|.*$`, 'm');
        md = md.replace(rx, (m) => {
          const comment = m.split('|').slice(10).join('|');
          const base = rowMap[name];
          return base + (comment ? ' ' + comment.trim() : '');
        });
      }
      writeFileSync(docPath, md, 'utf8');
    } catch {}
    expect(out.length).toBe(5);
  });
});
