---
title: "fix-tests"
mode: "top-tier-dev"
tools:
  - filesystem.read
  - filesystem.write
  - terminal.runTask
---

# Cieľ

Nájsť príčinu zlyhaných testov, opraviť minimálnym patchom a spustiť testy.

# Postup

1. Ak nie je čerstvý výstup, spusti testy (npm/pnpm/yarn; alebo pytest; podľa projektu).
2. Identifikuj koreň problému (nie umlčať test; opraviť príčinu).
3. Navrhni malý diff (patch per súbor), popíš prečo.
4. Spusť testy znova a zhrň výsledok.
