# STAGE DETECTION ISSUE - Komplexná analýza pre advisora

**Dátum**: 2025-10-26  
**Priorita**: 🔴 KRITICKÁ  
**Status**: Nefunkčné portfolio reaction na určité kombinácie vkladov/horizontu

---

## 1. Problém (User Report)

**Symptóm**: Portfolio buttony (Konzervatívny, Vyvážený, Rastový, Dynamický) **nereagujú** pri určitých kombináciách investičných parametrov.

### Nefunkčné scenáre (potvrdené userom):

| Jednorazový | Mesačný    | Horizont     | Stage                  | Problém      |
| ----------- | ---------- | ------------ | ---------------------- | ------------ |
| **49999€**  | **999€**   | **8 rokov**  | CORE → mal byť LATE    | ❌ Nereaguje |
| **0€**      | **400€**   | **8 rokov**  | CORE → mal byť STARTER | ❌ Nereaguje |
| **0€**      | **< 800€** | **8+ rokov** | CORE (pravdepodobne)   | ❌ Nereaguje |

### Funkčné scenáre (potvrdené userom):

| Jednorazový   | Mesačný    | Horizont  | Stage | Stav       |
| ------------- | ---------- | --------- | ----- | ---------- |
| **50000€+**   | akýkoľvek  | akýkoľvek | LATE  | ✅ Funguje |
| **akýkoľvek** | **1000€+** | akýkoľvek | LATE  | ✅ Funguje |

---

## 2. Root Cause Analysis

### 2.1 Stage Detection Logika

**Súbor**: `src/features/policy/stage.ts`

**Aktuálna implementácia** (po PR-14.1 úpravách):

```typescript
export function detectStage(
  lump: number,
  monthly: number,
  years: number,
  goal?: number
): Stage {
  // Počítaj rácio cieľa
  const investable = lump + monthly * 12 * Math.max(years, 0);
  const coverage = goal && goal > 0 ? investable / goal : undefined;

  // STARTER: malý kapitál a dlhší čas
  const isSmall = lump < 20_000 && monthly <= 500 && years >= 8;
  const isLowCoverage = coverage !== undefined && coverage < 0.35;

  // LATE: veľký kapitál alebo veľký mesačný vklad
  const isBig = lump >= 40_000 || monthly >= 800 || years <= 7;
  const isHighCoverage = coverage !== undefined && coverage >= 0.8;

  if (isBig || isHighCoverage) return "LATE";
  if (isSmall || isLowCoverage) return "STARTER";
  return "CORE"; // DEFAULT
}
```

### 2.2 Problém: "CORE" Stage Gap

**CORE stage vzniká ako fallback** pre všetky kombinácie, ktoré nespadajú ani do STARTER, ani do LATE.

**Príklad problémových kombinácií → CORE**:

1. **Jednorazový 0€ + Mesačný 600€ + 8 rokov**
   - `isSmall` = `false` (600 > 500)
   - `isBig` = `false` (600 < 800, 0 < 40k, 8 > 7)
   - **Výsledok**: CORE ❌

2. **Jednorazový 30000€ + Mesačný 500€ + 10 rokov**
   - `isSmall` = `false` (30k >= 20k)
   - `isBig` = `false` (30k < 40k, 500 < 800, 10 > 7)
   - **Výsledok**: CORE ❌

3. **Jednorazový 10000€ + Mesačný 700€ + 8 rokov**
   - `isSmall` = `false` (700 > 500)
   - `isBig` = `false` (10k < 40k, 700 < 800, 8 > 7)
   - **Výsledok**: CORE ❌

### 2.3 CORE Stage Caps (prísnejšie než STARTER/LATE)

**Súbor**: `src/features/portfolio/presets.ts` (enforceStageCaps)

CORE stage má **konzervatívnejšie limity** ako STARTER:

| Asset     | STARTER Cap | CORE Cap | LATE Cap | Rozdiel        |
| --------- | ----------- | -------- | -------- | -------------- |
| Dynamické | 15%         | 12%      | 12%      | CORE prísnejší |
| Krypto    | 7%          | 5%       | 5%       | CORE prísnejší |
| ETF       | 50%         | 40%      | 40%      | CORE prísnejší |
| Cash      | 50%         | 40%      | 30%      | CORE prísnejší |

**Dôsledok**:

- Viac redistributions v `enforceStageCaps`
- Vyššie riziko **unabsorbed overflow**
- Circuit breaker častejšie aktivovaný
- Mix sa **nezapíše do state** → portfolio nereaguje

---

## 3. Prečo Portfolio Nereaguje?

### 3.1 Tok udalostí (user zmení parametry):

1. **User zadá**: 0€ jednorazovo, 600€ mesačne, 8 rokov
2. **Stage detection**: → CORE (gap)
3. **getAdjustedPreset** volá `enforceStageCaps(preset, "CORE", profile)`
4. **enforceStageCaps**:
   - Aplikuje prísne CORE caps
   - Vzniká **veľká redistribúcia** (napr. cash 64% → cap 40%)
   - **Overflow 24%** nemôže byť absorbovaný
   - **PR-14 fix**: Skip `normalize()` → sum < 100% → circuit breaker vráti **cached result**
5. **BasicLayout.tsx effect** (riadok 265-295):
   - Získa adjusted preset
   - Ale **neaktualizuje mix automaticky** (riadok 294: "NEROB automatickú aktualizáciu mixu")
   - User musí **manuálne vybrať profil** (Vyvážený/Rastový...)
6. **User klikne na "Vyvážený"**:
   - Pokúsi sa nastaviť mix
   - Ale `enforceStageCaps` vráti **cached result z circuit breaker**
   - Mix sa **nezapíše do state**
   - **Portfolio buttony nereagujú** ❌

### 3.2 Circuit Breaker False Positive?

**Súbor**: `src/features/portfolio/presets.ts` (lines 108-130)

```typescript
// Cache key: mix percentages + risk + stage
const mixKey = mix.map((m) => `${m.key}:${m.pct.toFixed(2)}`).join("|");
const cacheKey = `${riskPref}-${stage}-${mixKey}`;

if (enforceStageCaps._cache.has(cacheKey)) {
  const cached = enforceStageCaps._cache.get(cacheKey);
  if (Date.now() - cached.time < 100) {
    // 100ms window
    console.warn(`[enforceStageCaps] LOOP DETECTED, returning cached result`);
    return cached.result; // PROBLÉM: Vráti starý result namiesto spracovania nového
  }
}
```

**Možný problém**:

- Cache time window **100ms je príliš dlhý**?
- Alebo cache **nikdy neexpiruje** (len time check)?
- Pri rýchlych zmenách parametrov (user typing) môže vrátiť **outdated result**

---

## 4. Možné Riešenia (Návrhy pre Advisora)

### 🔷 Riešenie A: Zrušiť CORE Stage (Simplifikované 2-stage)

**Princíp**: Použiť len STARTER a LATE, žiadny gap.

```typescript
export function detectStage(
  lump: number,
  monthly: number,
  years: number,
  goal?: number
): Stage {
  // LATE: vysoký kapitál ALEBO vysoký monthly ALEBO krátky horizont
  const isBig = lump >= 30_000 || monthly >= 500 || years <= 7;
  const isHighCoverage = goal && goal > 0 && investable / goal >= 0.8;

  if (isBig || isHighCoverage) return "LATE";
  return "STARTER"; // Všetko ostatné je STARTER (dlhý horizont, nižšie sumy)
}
```

**Výhody**:

- ✅ Žiadny gap → každá kombinácia má stage
- ✅ Jednoduché pravidlá, ľahko debugovateľné
- ✅ STARTER má mäkšie caps → menej redistribution conflicts

**Nevýhody**:

- ⚠️ Stráca nuansy (napr. stredne vysoké vklady s dlhým horizontom)
- ⚠️ STARTER caps môžu byť príliš permisívne pre niektoré scenáre

---

### 🔷 Riešenie B: Continuous Stage (Gradient namiesto diskrétnych kategórií)

**Princíp**: Stage ako **continuous score 0.0–1.0**, nie kategória.

```typescript
export function detectStageScore(
  lump: number,
  monthly: number,
  years: number
): number {
  // Agresivita = f(kapitál, čas)
  const capitalScore = Math.min(lump / 100_000, 1.0); // 0–100k mapy to 0.0–1.0
  const monthlyScore = Math.min(monthly / 2_000, 1.0); // 0–2k mapy to 0.0–1.0
  const timeScore = Math.max(0, (15 - years) / 15); // 15y→0.0, 0y→1.0 (kratší čas = konzervatívnejší)

  // Weighted average (kapitál má najväčšiu váhu)
  return 0.5 * capitalScore + 0.3 * monthlyScore + 0.2 * timeScore;
}

// Caps sú interpolované podľa score
function getCaps(score: number) {
  // Lineárna interpolácia medzi starter_caps a late_caps
  return {
    dyn: lerp(15, 12, score), // 15% na score=0, 12% na score=1
    crypto: lerp(7, 5, score),
    etf: lerp(50, 40, score),
    cash: lerp(50, 30, score),
  };
}
```

**Výhody**:

- ✅ Žiadne ostré hranice → smooth transitions
- ✅ Prispôsobí sa ľubovoľnej kombinácii parametrov
- ✅ Prirodzené správanie (vyššie sumy = konzervatívnejšie caps)

**Nevýhody**:

- ⚠️ Komplexnejšia implementácia (lerp funkcie, tuning váh)
- ⚠️ Ťažšie debugovať (nie je jasné "v akom stage je user")
- ⚠️ Riziko regressions v existujúcich testoch

---

### 🔷 Riešenie C: Fix CORE Stage Gaps (Rozšírené pravidlá)

**Princíp**: Rozšíriť STARTER/LATE podmienky, aby pokryli viac scenárov.

```typescript
export function detectStage(
  lump: number,
  monthly: number,
  years: number,
  goal?: number
): Stage {
  const investable = lump + monthly * 12 * Math.max(years, 0);
  const coverage = goal && goal > 0 ? investable / goal : undefined;

  // STARTER: malý kapitál A dlhý horizont (široká definícia)
  const isSmall =
    (lump < 30_000 && monthly < 800 && years >= 8) || // Rozšírené
    (lump === 0 && monthly <= 1000 && years >= 8) || // Edge case: žiadny lump sum
    (coverage !== undefined && coverage < 0.35);

  // LATE: vysoký kapitál ALEBO vysoký mesačný ALEBO krátky čas
  const isBig =
    lump >= 40_000 ||
    monthly >= 800 ||
    years <= 7 ||
    (coverage !== undefined && coverage >= 0.8);

  if (isBig) return "LATE";
  if (isSmall) return "STARTER";
  return "CORE"; // Len veľmi úzky gap (napr. 30k-40k lump, 800€ monthly, 8-10 rokov)
}
```

**Výhody**:

- ✅ Zachováva 3-stage model (kompatibilita s existujúcim kódom)
- ✅ Pokrýva viac edge cases
- ✅ CORE gap je teraz **minimálny** (nanaozaj stredné scenáre)

**Nevýhody**:

- ⚠️ Stále môžu existovať edge cases → future bugs
- ⚠️ Zložitejšie pravidlá → ťažšie debugovať

---

### 🔷 Riešenie D: Fix Circuit Breaker (Root Cause)

**Princíp**: Problém nie je v stage detection, ale v **circuit breaker cache**.

**Zmeny**:

1. **Skrátiť cache window**: 100ms → 50ms
2. **Vyčistiť cache pri zmene parametrov**: Nový `clearCache()` call v BasicLayout effect
3. **Cache key pridať timestamp z parametrov**: Aby sa odlíšil user input vs. rerender

```typescript
// BasicLayout.tsx (pred getAdjustedPreset)
enforceStageCaps._cache.clear(); // Vyčisti cache pri každej zmene parametrov

// alebo
const cacheKey = `${riskPref}-${stage}-${mixKey}-${Date.now()}`; // Vždy unikátny
```

**Výhody**:

- ✅ Stage detection ostáva bez zmien (menej regressions)
- ✅ Circuit breaker funguje len pre skutočné infinite loops
- ✅ User zmeny parametrov = fresh calculation

**Nevýhody**:

- ⚠️ Môže zhoršiť performance (viac calculations)
- ⚠️ Nestráni root cause (CORE stage gap)

---

## 5. Odporúčanie (Môj názor)

**Preferované riešenie**: **Kombinácia C + D**

1. **C: Rozšíriť STARTER pravidlá** → pokryť viac edge cases (nízke mesačné vklady + dlhý horizont)
2. **D: Fix circuit breaker** → clear cache pri zmene parametrov v BasicLayout effect

**Prečo**:

- ✅ Minimálne zmeny v stage detection (znížené riziko regressions)
- ✅ Circuit breaker funguje správne (len pre skutočné loops)
- ✅ Zachováva 3-stage model (STARTER/CORE/LATE) + kompatibilita s testami
- ✅ Rýchle riešenie (1-2 hodiny implementácie)

**Alternatíva (dlhodobé)**: **Riešenie B (Continuous Stage)** → Q1 2026 refactor.

---

## 6. Otázky pre Advisora

1. **Aký je biznis dôvod pre 3-stage model** (STARTER/CORE/LATE)? Môžeme zjednodušiť na 2 stages?

2. **Aké sú typické user profily**? (Príklady: študent 100€/mes, mladý profesionál 500€/mes, rodina 1000€/mes...)

3. **Kde je hranica medzi "agresívny rast" a "konzervatívna ochrana"**?
   - Kapitál: 20k? 50k? 100k?
   - Mesačný vklad: 500€? 800€? 1000€?
   - Horizont: 7 rokov? 10 rokov? 15 rokov?

4. **Sú CORE caps naozaj potrebné**? Alebo môžeme použiť len STARTER/LATE caps?

5. **Môžeme použiť continuous score** (0.0–1.0) namiesto diskrétnych stages? Alebo by to bolo mätúce pre userov?

---

## 7. Testové Scenáre (Pre Overenie Riešenia)

| ID  | Lump    | Monthly | Years | Očakávaný Stage | Funguje? |
| --- | ------- | ------- | ----- | --------------- | -------- |
| T1  | 0€      | 100€    | 10    | STARTER         | ❓       |
| T2  | 0€      | 400€    | 8     | STARTER         | ❌       |
| T3  | 0€      | 600€    | 8     | STARTER/CORE    | ❌       |
| T4  | 0€      | 1000€   | 8     | LATE            | ✅       |
| T5  | 10000€  | 500€    | 10    | STARTER         | ❓       |
| T6  | 30000€  | 500€    | 8     | CORE            | ❌       |
| T7  | 49999€  | 999€    | 8     | LATE            | ❌       |
| T8  | 50000€  | 0€      | 8     | LATE            | ✅       |
| T9  | 20000€  | 300€    | 15    | STARTER         | ❓       |
| T10 | 100000€ | 2000€   | 5     | LATE            | ✅       |

---

## 8. Next Steps

1. **Advisor rozhodne**: Riešenie A / B / C / D / iné?
2. **Implementácia**: Podľa zvoleného riešenia
3. **Testy**: Overiť všetky scenáre z tabuľky T1-T10
4. **Dokumentácia**: Aktualizovať stage detection docs
5. **Commit + push**: Až po user schválení

---

**Pripravené pre**: Advisor / Product Owner  
**Autor**: Kai (AI Assistant)  
**Dátum**: 2025-10-26 22:05 UTC
