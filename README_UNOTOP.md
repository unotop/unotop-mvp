# UNOTOP Planner (Modular Rebuild)

Minimal modular investment planner rebuilt from corrupted monolith.

## Modules

- `src/utils/number.ts` – clamp, pctFmt, euro
- `src/domain/finance.ts` – fvMonthly, fairRoundTo100
- `src/domain/assets.ts` – asset definitions + DEFAULT_MIX
- `src/domain/risk.ts` – computeRisk with penalties
- `src/domain/recommendation.ts` – heuristic allocation
- `src/domain/optimizer.ts` – brute-force coarse optimizer (step %)
- `src/components` – RiskGauge + input components
- `src/sanity.ts` – dev console sanity checks (runs only in dev)

## Key Constraints

- Gold >= 10%
- Dynamic <= 30%
- Real estate gated by income >= 3 500 € alebo lump sum >= 300 000 €

## Development

Assumes Vite React + TypeScript.

Typical commands:

```bash
npm install
npm run dev
```

## Optimizer

`findBestPortfolio(assets, { step:5, maxSolutions:5 })` enumerates integer mixes, filters by constraints, ranks by expectedReturn/risk.

## Future Enhancements

- State persistence (localStorage)
- Recharts trajectory graph
- Collapsible sections (sec3Open/sec4Open already reserved)
- Pareto frontier / multi-objective view

## Disclaimer

Illustrative only; not financial advice.
