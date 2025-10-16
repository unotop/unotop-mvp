---
title: "refactor-safe"
mode: "top-tier-dev"
tools:
  - filesystem.read
  - filesystem.write
  - terminal.runTask
---

# Cieľ

Bezpečný refaktor bez zmeny správania.

# Postup

1. Vymenuj rizikové miesta a plán malých krokov.
2. Urob incremental diffs (premenné, funkcie, moduly).
3. Doplň alebo uprav testy (regresné, edge cases).
4. Zhrni dopad na výkonnosť a DX.
