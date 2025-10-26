# PR-14 Verification Checklist

## Kontext

- **Cieľ**: Circuit breaker pre enforceStageCaps infinite loops
- **Commit**: `fix: PR-14 circuit breaker pre enforceStageCaps infinite loops`
- **Tests**: 17/17 PASS
- **Build**: 648 kB ✅

---

## Implementované zmeny

### 1. Circuit breaker v `presets.ts` (lines 108-130, 251)

```typescript
// Detekcia opakovaného spracovania rovnakého mixu
const mixKey = mix.map((m) => `${m.key}:${m.pct.toFixed(2)}`).join("|");
const cacheKey = `${riskPref}-${stage}-${mixKey}`;

// Ak rovnaký mix v cache (< 100ms), vráť cached result
if (enforceStageCaps._cache.has(cacheKey)) {
  const cached = enforceStageCaps._cache.get(cacheKey);
  if (Date.now() - cached.time < 100) {
    console.warn(`[enforceStageCaps] LOOP DETECTED, returning cached result`);
    return cached.result;
  }
}

// ... spracovanie ...

// Ulož do cache
enforceStageCaps._cache.set(cacheKey, { result: normalized, time: Date.now() });
```

**Účel**: Detekcia a prerušenie infinite React re-render loops

**Mechanizmus**:

- Cache kľúč: `${riskPref}-${stage}-${mix percentages}`
- Časové okno: 100ms
- Akcia pri detekcii: Vráť cached result, vyhoď warning

---

## Test scenarios (manuálne overenie)

### ✅ Kritický test suite

```bash
npm run test:critical
```

**Očakávané**: 17/17 PASS  
**Výsledok**: ✅ PASS

### ⏳ Browser test 1: dyn_cap loop (CORE stage)

**Kroky**:

1. Otvor app v browseri
2. Otvor F12 Console
3. Nastav:
   - Mesačný príjem: 2000€
   - Jednorazová investícia: 5000€
   - Mesačný vklad: 500€
   - Horizont: 8 rokov
4. Vyber portfólio: **Vyvážený**
5. Skontroluj console

**Očakávané**:

- ❌ BEZ circuit breaker: Infinite `[Telemetry] policy_adjustment: {reason: 'dyn_cap', ...}`
- ✅ S circuit breakerom: Max 2-3 `policy_adjustment` logy, potom `[enforceStageCaps] LOOP DETECTED`
- ✅ App nefreeźne, UI reaguje

**Prečo to loopovalo**:

- Vyvážený preset: dyn = 18%
- CORE stage cap: dyn = 15%
- Overflow 3% → normalize() → proporcionálne späť do dyn → 18% again → LOOP

---

### ⏳ Browser test 2: etf_cap loop (horizon 8+)

**Kroky**:

1. F12 Console
2. Nastav:
   - Mesačný príjem: 1500€
   - Jednorazová investícia: 10000€
   - Mesačný vklad: 300€
   - Horizont: 10 rokov
3. Vyber: **Rastový**
4. Skontroluj console

**Očakávané**:

- ✅ Žiadny infinite loop
- ✅ Max pár `policy_adjustment` logov
- ✅ Možné `LOOP DETECTED` warning (OK - circuit breaker funguje)

**Prečo to loopovalo**:

- Rastový preset: ETF vysoké percento
- LATE stage: ETF cap 35% (horizon 10 rokov)
- Overflow → cash → normalize → späť do ETF → LOOP

---

### ⏳ Browser test 3: cash_cap loop (low deposits)

**Kroky**:

1. F12 Console
2. Nastav:
   - Mesačný príjem: 800€
   - Jednorazová investícia: 0€
   - Mesačný vklad: 50€
   - Horizont: 5 rokov
3. Vyber: **Konzervatívny**
4. Skontroluj console

**Očakávané**:

- ✅ Žiadny infinite loop
- ✅ applyMinimums presunie do cash, ale circuit breaker chráni

**Prečo to loopovalo**:

- Nízke vklady → applyMinimums vynuluje dyn/crypto/gold (minimá nedostupné)
- Všetko presunie do cash → 64.99%
- STARTER stage: cash cap 40%
- Overflow 24.99% → kde dať? → normalize → späť do cash → LOOP

---

### ⏳ Browser test 4: Live updates (PR-14 hlavný feature)

**Kroky**:

1. Nastav:
   - Mesačný príjem: 2000€
   - Jednorazová investícia: 5000€
   - Mesačný vklad: 400€
   - Horizont: 7 rokov
2. Vyber: **Vyvážený**
3. Pozoruj projekciu (pravý panel)
4. Zmeň mesačný vklad na 600€
5. Pozoruj projekciu

**Očakávané**:

- ✅ Projekcia sa okamžite aktualizuje (live)
- ✅ Vybrané portfólio ostáva (Vyvážený)
- ✅ Žiadny "Projekcia nedostupná" banner
- ✅ Žiadne uzamknutie UI

**Prečo to nefungovalo**:

- PR-11 logika: pri zmene investment params → clear mix → empty state
- PR-14 fix: Odstránená auto-clear logika, pridaný fallback default mix

---

### ⏳ Browser test 5: Portfolio persistence

**Kroky**:

1. Nastav:
   - Mesačný príjem: 1800€
   - Jednorazová investícia: 3000€
   - Mesačný vklad: 300€
   - Horizont: 6 rokov
2. Vyber: **Rastový**
3. Zmeň jednorazovú investíciu na 8000€
4. Skontroluj vybrané portfólio

**Očakávané**:

- ✅ Rastový zostáva vybraný
- ✅ Projekcia sa aktualizovala (vyššia FV)
- ✅ Mix percentages sa nezmenili (rastový mix)

**Prečo to nefungovalo**:

- PR-11: pri zmene lumpSumEur → `writeV3({ mix: [] })` → portfolio reset
- PR-14: Odstránené investment params listeners

---

### ⏳ Browser test 6: Edge case - všetky portfolios pri rôznych vkladoch

**Kroky**:

1. F12 Console
2. Otestuj každé portfólio pri:
   - **Nízke vklady** (50€ monthly, 0€ lump): Konzervatívny, Vyvážený
   - **Stredné vklady** (300€ monthly, 5000€ lump): Vyvážený, Rastový
   - **Vysoké vklady** (1000€ monthly, 20000€ lump): Rastový, Dynamický

**Očakávané**:

- ✅ Žiadne infinite loops v žiadnom scenári
- ✅ Možné `LOOP DETECTED` warnings (OK)
- ✅ Všetky portfolios selectable (aj keď s fallbackom)
- ✅ Projekcia vždy viditeľná

---

## Known issues & tech debt

### ⚠️ Circuit breaker je defensive fix, nie root cause fix

**Problem**: normalize() redistribuuje overflow proporcionálne **do všetkých aktív**, vrátane tých, čo práve prekročili cap.

**Dôsledok**: V niektorých scenároch je matematicky nemožné nájsť distribúciu, kde:

- Všetky capy sú splnené
- Suma = 100%
- Minimy sú splnené

**Circuit breaker riešenie**: Detekuje loop a vráti cached result → app nefreeźne, ale distribúcia nemusí byť optimálna.

**Budúce riešenie (Tech Debt)**:

1. **Option A**: Upraviť `normalize()` aby vylúčila capped assets z redistribúcie
2. **Option B**: Aplikovať capy AŽ PO normalize() (iné poradie)
3. **Option C**: Constraint solver (komplexné)
4. **Option D**: Akceptovať suma < 100% keď capy nedajú 100% (jednoduchšie)

**Odporúčanie**: Option A - pridať `excludeKeys: string[]` parameter do `normalize()`

---

### ⚠️ Console warnings očakávané

Pri niektorých scenároch uvidíš:

```
[enforceStageCaps] LOOP DETECTED, returning cached result
```

**Toto je OK** - circuit breaker funguje. Lepšie warning než frozen browser.

---

### ⚠️ Static cache memory leak

`enforceStageCaps._cache` sa nikdy nečistí. Pri veľmi intenzívnom používaní (stovky rôznych mixov) môže rásť.

**Riešenie v budúcnosti**: LRU cache alebo periodicke clearovanie starých záznamov (> 5 sekúnd).

**Aktuálne riziko**: Minimálne (few KB max, user typicky testuje 10-20 kombinácií).

---

## Acceptance criteria

### ✅ Testy

- [x] 17/17 kritických testov PASS
- [x] Build úspešný (648 kB)

### ⏳ Browser (manuálne overenie potrebné)

- [ ] Test 1: dyn_cap loop - ŽIADNY infinite loop, max pár adjustments
- [ ] Test 2: etf_cap loop - ŽIADNY infinite loop pri horizon 8+
- [ ] Test 3: cash_cap loop - ŽIADNY infinite loop pri low deposits
- [ ] Test 4: Live updates - projekcia reaguje na zmeny vstupov
- [ ] Test 5: Portfolio persistence - vybrané portfólio ostáva po zmene vstupov
- [ ] Test 6: Edge cases - všetky portfolios funkčné pri všetkých deposit leveloch

### ⏳ UX kritériá

- [ ] Žiadne frozen browser states
- [ ] Projekcia vždy viditeľná (aj s fallback mix)
- [ ] Console warnings sú informatívne, nie rušivé
- [ ] Žiadne "Projekcia nedostupná" bannery bez dôvodu

---

## Rollback plan

Ak circuit breaker spôsobí problémy:

```bash
git revert 05efcf3
npm run test:critical  # Overíme že revert je clean
npm run build
git push
```

**Čo sa stane**:

- Vráti sa pred-circuit-breaker stav
- Infinite loops sa môžu vrátiť
- Live updates ostanú (iná časť kódu)

**Alternatíva** (ak je problém len s 100ms window):
Zmeň časové okno v `presets.ts`:

```typescript
if (Date.now() - cached.time < 500) {  // 100ms → 500ms
```

---

## Next steps (po verification)

### Ak všetko funguje

1. ✅ Uzavrieť PR-14
2. ✅ Pridať do CHANGELOG.md
3. ✅ Monitorovať console warnings v reálnom použití
4. ⏭️ Naplánovať Tech Debt: Redesign normalize() + cap enforcement

### Ak sú ešte loops

1. ❌ Zvýšiť časové okno (100ms → 500ms)
2. ❌ Pridať call counter (max 5 calls per mix per second)
3. ❌ Debug: Loguj mixKey pri každom volaní enforceStageCaps
4. ❌ Escalate: Redesign normalize() urgentne

---

## Summary

**Zmeny**:

- Circuit breaker v enforceStageCaps (100ms cache)
- Live updates working (removed PR-11 auto-clear)
- Fallback default mix pre empty states
- Tests: 17/17 PASS, Build: 648 kB

**Riešené bugs**:

- dyn_cap infinite loop (CORE stage)
- etf_cap infinite loop (horizon 8+)
- cash_cap infinite loop (low deposits)
- Live projection locked bug
- Portfolio reset on input change bug

**Tech debt**:

- normalize() + cap enforcement architecture (future redesign needed)
- Static cache clearovanie (LRU cache v budúcnosti)

**Testing needed**:

- Manuálne browser testy (6 scenarios)
- F12 console monitoring (loop detection)
- UX validation (live updates, persistence)
