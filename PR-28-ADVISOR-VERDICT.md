# PR-28 ADVISOR VERDICT – Riešenie enforceRiskCap DEADLOCK

## 📋 EXECUTIVE SUMMARY

**Verdikt**: Problém nie je v nízkych vkladoch ako takých, ale v tom, že sa v `enforceRiskCap` bijú **3 veci naraz**:

1. **Bonds sú naraz "risk asset" aj "safe fallback"** → ping-pong cyklus
2. **Stage capy (najmä zlato 40%) vs. riskMax** sa pri normalizácii pretláčajú
3. Pri **úplne malých plánoch** (50€/5 rokov) sa vôbec neoplatí agresívne riešiť risk

---

## ✅ RIEŠENIE (koncepčné)

### Pre normálne a veľké plány (`effectivePlanVolume ≥ 5,000€`)

Necháme `riskMax` **5/7/8.5** ako cieľ, ale:

- ✅ Upravíme `enforceRiskCap`, aby **neping-pongoval bonds**
- ✅ Necháme **stage caps ako "hard"** (zlato ≤ 40%, ETF ≤ 50% atď.)
- ✅ `riskMax` ako **"best effort + warning"** (ak nedosiahneme, aspoň výrazne zlepšiť)

### Pre mini plány (`effectivePlanVolume < 5,000€`)

- ✅ `enforceRiskCap` **úplne preskočiť**
- ✅ Tam je dôležitejšie užívateľovi ukázať, že **plán je malý**, než sa matematicky biť o každý desatinný bod rizika

**Výsledok**: Odstránime deadlocky, validácie padania a zároveň sa k nízkým vkladom správame normálne (nie preoptimalizovane).

---

## 🔍 DÔVODY (čo je fakt rozbité)

### 1. Ping-pong na bonds

- V `RISK_ORDERED_KEYS` sú bonds ako **rizikový asset**
- V `SAFE_TARGET_FALLBACK` ich zároveň používame ako **„bezpečný cieľ"**
- **Dôsledok**:
  - Iterácia N: fallback bonds **+1.4 p.b.**
  - Iterácia N+1: risk loop bonds **−1.8 p.b.**
  - Risk sa takmer nehýbe, ale spotrebúvame iterácie → **pseudo nekonečný cyklus** (konzervatívny profil)

### 2. Zlato je už na (alebo nad) strope, fallback nemá kam nalievať

- **Konzervatívny**: gold 40.3% (cap 40%)
- **Vyvážený**: gold 40.0%
- **Rastový**: gold 39.7%
- PRIMARY safe (gold+cash) je prakticky plný, cash cap nízky (7/10/50% podľa profilu)
- Fallback do bonds/ETF sa rýchlo vypchá → zostane zvyšok p.b., s ktorým už nevieme pohnúť → **DEADLOCK**

### 3. Normalizácia po alokácii "prelezie" stage capy

- Aj keď pri alokácii dodržíme **0.99 buffer**, po normalizácii na 100% zlato skončí na **40.22%**
- Validácia spadne, hoci ide o zaokrúhlovanie

### 4. Pri úplne malých plánoch je risk enforcer overkill

- Scenár: **0€ / 50€ / 5 rokov** = `effectivePlanVolume` 3,000€
- Tu chceme, aby appka povedala **"Mini plán, pridaj vklad"**, nie aby sme tam hnali 15 iterácií a riešili, či je risk 7.1 alebo 6.9

---

## 🎯 NÁVRH – Konkrétne riešenie

Rozdelené na **A) Policy rozhodnutia** a **B) Technické kroky pre CS**.

---

## A) POLICY ROZHODNUTIA

### 1. Mini vs. normálny plán

**Definícia**:

```typescript
effectivePlanVolume = lumpSum + monthly * horizonYears * 12;
```

- **Mini plán**: `effectivePlanVolume < 5,000€`
- **Normálny plán**: `effectivePlanVolume ≥ 5,000€`

**Policy**:

- **Pre Mini plány** → `enforceRiskCap` **preskočiť** (nechať len existujúci DOWN-TUNE/UP-TUNE + stage caps)
  - V UI priznať: **Sila plánu: "Mini plán – skôr symbolické sporenie, odporúčame navýšiť vklady"**

- **Pre normálne plány** → `enforceRiskCap` beží, musí risk výrazne stiahnuť smerom k `riskMax`
  - V ideále pod `riskMax`, ale ak sa nedá, tak aspoň **viditeľne menej** než pôvodný risk

**Dôsledok**: Zabijeme „blbca 50€/5 rokov" – nebude nám rozbíjať algoritmus, ale dostane jasný feedback, že plán je slabý.

---

### 2. Priorita: stage caps vs. riskMax

**Rozhodnutie**:

- **Stage caps** (zlato 40%, ETF 50%, reality 12% atď.) sú **HARD** – nechceme portfólio, ktoré ide nad tieto stropy
- **RiskMax** (5/7/8.5) je **"hard goal"**, ale ak sa to v rámci stage caps nedá:
  - Risk sa musí aspoň **významne zlepšiť** vs. pôvodný stav
  - V UI dostane používateľ **warning**, že pri danom nastavení (profil/vklady/horizont) sme limitovaní

**Prakticky**:

1. Po `enforceRiskCap` → `enforceStageCaps` **ešte raz** → potom risk prepočítať
2. Ak je `risk ≤ riskMax` → **OK**
3. Ak je `risk > riskMax`, ale aspoň **o X bodov nižší** než pôvodný (napr. min. −0.5) **a zároveň** `≤ riskMax + 0.3` → **akceptujeme s warningom**

---

### 3. Bonds ako "polovične safe" – nie v oboch svetoch naraz

**Rozhodnutie**:

- Bonds (konzervatívne dlhopisy) budeme brať ako **bezpečnejšie než ETF/dyn/real/crypto**, ale aby nebol ping-pong:
  - **NEbudú v `RISK_ORDERED_KEYS`** (enforcer ich nebude aktívne krájať)
  - Ostanú len v **fallback/secondary safe targetoch**

**Argument**:

- Bonds majú risk cca **1.5–2.0**, ETF okolo **3.0**, dyn/real/crypto ešte viac
- Ak sme už pred `enforceRiskCap` bonds nejako nastavili cez stage/strategie, je OK nechať ich v peace a krájať radšej **ETF/dyn/crypto/real**

---

### 4. RiskMax – "tvrdé" číslo, ale s rozumom

- `riskTarget` (4 / 6 / 7.5) ostáva tak, ako je dnes (aj so stage bonusmi)
- `riskMax` = nová **pevná hranica profilu**:
  - **Conservative**: 5.0
  - **Balanced**: 7.0
  - **Growth**: 8.5

**Pri normálnych plánoch**:

- Ak po všetkých krokoch nedosiahneme `risk ≤ riskMax` kvôli stage caps / min zlata / asset minimám
- Ale risk je aspoň **výrazne nižší** než pôvodný **a** `≤ riskMax + 0.3` → **berieme to s warningom**

**Vysvetlenie**: To je praktický kompromis k "nesmie ujsť o viac než 1 bod" – tvoja 1.0 rezerva je medzi target a max, my nad max tolerujeme ešte cca **+0.3** iba v extrémnych edge case.

---

## B) TECHNICKÉ KROKY PRE CS

### 1. Bonds v risk vs. fallback (riešenie Problém #1)

✅ **SÚHLASÍM**: Bonds **NEMAJÚ byť v `RISK_ORDERED_KEYS`**.

**Implementácia** (Riešenie A):

```typescript
// enforceRiskCap.ts
const RISK_ORDERED_KEYS: AssetKey[] = [
  "crypto",
  "dyn",
  "real",
  "bond3y9" /* bez 'bonds' */,
  ,
  "etf",
  "gold",
  "cash",
];
```

- Bonds zostanú len v safe targetoch (fallback/secondary)
- Vyhneme sa ping-pongu „bonds +, bonds −"

---

### 2. Stage caps po enforceRiskCap (Riešenie D)

✅ **ÁNO**: Chcem, aby `enforceStageCaps` išiel **EŠTE RAZ** po `enforceRiskCap`.

**Flow**:

```
STEP 5: Asset minimums
STEP 5.5A: DOWN-TUNE
STEP 5.5B: UP-TUNE
STEP 5.6: Conservative guardrail
STEP 6: Stage caps enforcement
STEP 7: Cash cap final enforcement
STEP 8: enforceRiskCap (nová funkcia)
STEP 9: enforceStageCaps (znova)          ← NOVÝ KROK
STEP 10: final normalize + risk recompute + warnings
```

**Po STEP 9**:

1. Prepočítať risk
2. Ak `risk ≤ riskMax` → **OK**
3. Ak `risk > riskMax` **&** `≤ riskMax + 0.3` **&** zároveň `< pôvodný risk` → **OK + warning chip**:
   - **"Riziko blízko horného limitu – pri vašom nastavení narážame na hranice pravidiel."**

---

### 3. Buffer 0.99 vs. stage cap rounding (Problém #4)

**Návrh**: Jemný tweak bufferu:

**Variant A** (konzervativny):

```typescript
const buffer = 0.97; // CHANGED from 0.99
```

**Variant B** (dynamic):

```typescript
const buffer = availableRoom < 5 ? 0.95 : 0.99;
```

**Inštrukcia pre CS**:

> "Buffer pri alokácii safe targetov zníž na **0.97** (alebo dynamic podľa room), aby stage caps mali rezervu aj po normalizácii."

**Cieľ**: Aby sa kvôli zaokrúhleniu zlato nedostávalo nad 40% o 0.2 p.b. a nepadali sme na validácii.

---

### 4. 3-level fallback (Riešenie C) – zatiaľ NIE povinné

**Pre tento PR NEPOTREBUJEME** plnohodnotný 3-level fallback.

**Namiesto toho**:

- **PRIMARY safe**: gold + cash (ako teraz)
- **SECONDARY safe**: bonds (použité až keď sú gold+cash plné)
- **ETF** zatiaľ nech je len risk asset, **nie safe target**

**Ak po úpravách A + D + buffer** stále budú edge case problémy, môžeme v ďalšom kroku rozšíriť fallback aj o ETF (TERTIARY), ale teraz to nenúťme.

---

### 5. Mini plány – Riešenie E

✅ **ÁNO**: Chcem **graceful degradation** pre malé plány.

**Implementácia**:

```typescript
// V mixAdjustments.ts, pred enforceRiskCap
if (effectivePlanVolume < 5000) {
  return {
    mix: originalMixAfterStageAndCashCaps,
    enforcedRiskCapSkipped: true,
  };
}
```

**V UI sa to prejaví**:

- Box **"Sila plánu"** = **Mini plán**
- Doplniť text:
  > "Pri tomto objeme ide skôr o symbolické sporenie. Zvážte navýšenie vkladu, aby sme vedeli nastaviť portfólio tak, aby malo reálny vplyv na váš majetok."

**Dôsledok**: 50€/5 rokov nebudeme "mučiť" `enforceRiskCap`, ale používateľ aj tak uvidí, že je to slabé.

---

### 6. Testing priority – normálne vs. mini vklady

**Kľúčové scenáre na test** (zarámcované policy):

#### Scenár A: Mini plán

```
Vstup: 0€ / 50€ / 5 rokov
effectivePlanVolume: 3,000€
```

**Očakávanie**:

- ✅ `enforceRiskCap` preskočený
- ✅ Sila plánu: **Mini**
- ✅ Risk síce nemusí byť ideálny, ale to je OK – hlavná message je **"pridaj vklad"**

---

#### Scenár B: Normálny nízky lump, vyšší mesačný

```
Vstup: 0€ / 200€ / 20 rokov
effectivePlanVolume: 48,000€
```

**Očakávanie**:

- ✅ **Conservative**: risk ~4–5, BEZ extrémnych real/dyn/crypto
- ✅ **Balanced**: ~6–7
- ✅ **Growth**: ≤ 8.5 (často pod)
- ✅ Reality **iba ak** efektívny objem ≥ 50k (tu ešte nie)

---

#### Scenár C: Normálny s jednorazovou

```
Vstup: 23,000€ + 200€ / 20 rokov
effectivePlanVolume: 71,000€
```

**Očakávanie**:

- ✅ **Growth**: ≤ 8.5 po `enforceRiskCap`
- ✅ Bonds a reality využité
- ✅ Cash ≤ 5%, zlato ≤ 40%, ETF ≤ 50%

---

**Ak po A + D + mini-skip** stále niektorý z týchto failuje, potom má zmysel siahnuť po **"medium fix"** (3-level fallback a dynamic buffer).

---

## 🚀 PRIORITY (čo s tým teraz)

### ⚡ Kratkodobý fix (TERAZ)

1. ✅ Odstrániť **bonds** z `RISK_ORDERED_KEYS`
2. ✅ Pridať druhý `enforceStageCaps()` **po** `enforceRiskCap()` (STEP 9)
3. ✅ Zaviesť **skip `enforceRiskCap`** pre `effectivePlanVolume < 5,000`
4. ✅ Mierne znížiť buffer **(0.97 alebo dynamic)**
5. ✅ Otestovať **tri scenáre vyššie**

**Dôležité pre teba**:

- Či konzervatívny už **nekričí 7+ risk** pri rozumných vstupoch
- Či rastový **neskočí na 9.6**

---

### 📦 Ak všetko prejde

- ✅ Nech CS dorobí **UX** (Sila plánu, asset unlock, nudge)

---

### 🔧 Ak niečo ešte škrípe

- Môžeme v ďalšom kroku zaviesť **3-level fallback** (gold+cash → bonds → ETF)
- Ale to už bude **"medium PR"**

---

## 📝 SUMMARY PRE CS

**Implementuj presne tieto zmeny** (v tomto poradí):

1. **enforceRiskCap.ts**: Odstráň `'bonds'` z `RISK_ORDERED_KEYS` (riadok ~33)
2. **enforceRiskCap.ts**: Buffer zníž na `0.97` (alebo dynamic) (riadok ~210, 235)
3. **mixAdjustments.ts**: Skip `enforceRiskCap` ak `effectivePlanVolume < 5000` (pred STEP 8)
4. **mixAdjustments.ts**: Pridaj `enforceStageCaps()` PO `enforceRiskCap()` (nový STEP 9)
5. **mixAdjustments.ts**: Po STEP 9 recompute risk + warning logic (`risk > riskMax && risk ≤ riskMax + 0.3`)

**Po implementácii**:

- Test scenáre A, B, C
- Ak PASS → commit + push
- Ak FAIL → report konkrétny scenár + console logs

---

**KONIEC VERDIKTU**
