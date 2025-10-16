---
title: "debug-now"
mode: "top-tier-dev"
tools:
  - filesystem.read
  - filesystem.write
  - terminal.runTask
---

# Cieľ

Rýchla diagnostika chyby na základe stack trace/logu a vytvorenie fixu.

# Postup

1. Reprodukcia problému (príkaz alebo kroky).
2. Hypotéza príčiny → overenie.
3. Malý fix + dôvod.
4. Overenie (lokálne testy/beh) a krátke zhrnutie.
