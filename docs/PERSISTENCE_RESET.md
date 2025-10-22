# 🔄 Persistence & Reset Feature

## **Čo je implementované**

### **1. Automatické ukladanie (localStorage)**

Všetky nastavenia sa **automaticky ukladajú** pri každej zmene:

- ✅ **Cashflow**: Mesačný príjem, Fixné výdavky, Variabilné výdavky
- ✅ **Rezerva**: Suma (EUR), Počet mesiacov
- ✅ **Investície**: Jednorazový vklad, Mesačný vklad, Horizont, Cieľ
- ✅ **Portfólio**: Mix aktív (zlato, ETF, dlhopisy, krypto, atď.)
- ✅ **Profil**: Typ klienta (individual/family/firm), Rizikový profil
- ✅ **Dlhy**: Všetky pridané dlhy a hypotéky (PRO režim)
- ✅ **Režim**: BASIC vs PRO prepínač

**Mechanizmus:**

- Každý input má `onBlur` handler → volá `writeV3()` → localStorage
- Keys: `unotop:v3` (primárny) + `unotop_v3` (alias, synchronizované)
- Hydration: Pri načítaní stránky sa dáta automaticky načítajú z localStorage

---

### **2. Reset tlačidlo**

**Umiestnenie:** Toolbar (vpravo hore, vedľa BASIC/PRO prepínača)

**Dizajn:**

- 🔴 Malé červené tlačidlo s ikonou "↻" (reload)
- Text: "Reset" (skryté na mobile, len ikona)
- Ring: `ring-red-500/30` → červený okraj
- Hover: Zvýraznenie na `bg-red-900/50`

**Funkčnosť:**

1. Klik na "Reset" → Otvorí sa confirmation popover
2. Popover zobrazí:
   - ⚠️ Varovanie: "Resetovať nastavenie?"
   - Detail: "Vymažú sa všetky uložené údaje..."
   - 2 tlačidlá: "Áno, vymazať" (červené) + "Zrušiť" (šedé)
3. Po potvrdení:
   - Vymaže `localStorage.removeItem('unotop:v3')`
   - Vymaže `localStorage.removeItem('unotop_v3')`
   - Reload stránky → defaultné hodnoty

**UX features:**

- ✅ **Click outside**: Popover sa zatvorí pri kliku mimo
- ✅ **Confirmation required**: Nemôžeš omylom zmazať (2-step process)
- ✅ **Accessible**: `aria-label`, tooltip na hover
- ✅ **Responsive**: Na mobile len ikona (text skrytý cez `hidden sm:inline`)

---

## **Ako to funguje**

### **A) Persistence Flow**

```
User zmení input (napr. Mesačný príjem)
         ↓
onBlur event
         ↓
writeV3({ profile: { monthlyIncome: 3000 } })
         ↓
localStorage.setItem('unotop:v3', JSON.stringify(data))
localStorage.setItem('unotop_v3', JSON.stringify(data))
         ↓
Data uložené ✅
```

**Pri načítaní stránky:**

```
Page load
    ↓
readV3() → localStorage.getItem('unotop:v3')
    ↓
useState(initialValue z localStorage)
    ↓
Všetky inputy majú správne hodnoty ✅
```

---

### **B) Reset Flow**

```
User klikne "Reset" tlačidlo
         ↓
Popover: "Resetovať nastavenie?"
         ↓
User potvrdí "Áno, vymazať"
         ↓
localStorage.removeItem('unotop:v3')
localStorage.removeItem('unotop_v3')
         ↓
window.location.reload()
         ↓
Page načíta defaultné hodnoty (localStorage prázdne)
         ↓
Clean state ✅
```

---

## **Technické detaily**

### **Súbory:**

1. **`src/components/Toolbar.tsx`**
   - Pridaný `onReset?: () => void` prop
   - Reset button s confirmation popover
   - Click-outside handler (close popover)

2. **`src/BasicLayout.tsx`**
   - `handleReset()` funkcia
   - Prop drilling: `onReset={handleReset}` → Toolbar

3. **`src/LegacyApp.tsx`**
   - Rovnaká `handleReset()` implementácia
   - PRO režim má tiež reset button

4. **`src/persist/v3.ts`**
   - Už existujúce `readV3()` / `writeV3()` funkcie
   - Žiadne zmeny potrebné

---

## **Defaultné hodnoty (po reset)**

Po resetovaní sa nastavia tieto hodnoty:

```typescript
// Profile
monthlyIncome: 0;
fixedExp: 0;
varExp: 0;
lumpSumEur: 0;
monthlyVklad: 0(monthly);
horizonYears: 10;
goalAssetsEur: 0;
reserveEur: 0;
reserveMonths: 0;
clientType: "individual";
riskPref: "vyvazeny";
modeUi: "BASIC";

// Mix (portfólio)
mix: []; // prázdne, používateľ musí vybrať preset alebo nastaviť manuálne

// Debts (PRO režim)
debts: [];
```

---

## **Vizuálna špecifikácia**

### **Reset tlačidlo (Toolbar)**

```tsx
// Desktop (sm+)
┌──────────────────┐
│  ↻  Reset       │  ← Text viditeľný
└──────────────────┘

// Mobile (<sm)
┌──────┐
│  ↻  │  ← Len ikona
└──────┘

// Farby
Background: bg-red-900/30
Hover: bg-red-900/50
Text: text-red-400 → text-red-300 (hover)
Ring: ring-red-500/30 → ring-red-500/50 (hover)
```

### **Confirmation Popover**

```
┌─────────────────────────────────┐
│ ⚠️ Resetovať nastavenie?        │
│                                 │
│ Vymažú sa všetky uložené údaje  │
│ (príjem, výdavky, investície,   │
│ portfólio).                     │
│                                 │
│ ┌──────────────┐ ┌───────────┐ │
│ │ Áno, vymazať │ │  Zrušiť   │ │
│ └──────────────┘ └───────────┘ │
└─────────────────────────────────┘
   ↑
   Positioned: top-full right-0 mt-2
   Width: 256px (w-64)
   Z-index: 50
```

---

## **A11y (Accessibility)**

- ✅ `aria-label="Resetovať nastavenie"` na tlačidle
- ✅ `title="Vymazať všetky uložené nastavenia"` tooltip
- ✅ Keyboard navigable (Tab → Enter/Space)
- ✅ Vizuálne warning (⚠️ emoji + červená farba)
- ✅ Clear action labels ("Áno, vymazať" vs "Zrušiť")

---

## **Edge Cases**

### **1. Refresh počas vyplnenia formulára**

✅ **Riešené**: Všetky zmeny sa ukladajú na `onBlur`, takže po refresh sú dáta zachované.

### **2. Multiple tabs**

⚠️ **Možný problém**: Ak máš otvorené 2 taby, zmena v jednom sa neprejaví v druhom (localStorage event listener nie je implementovaný).

**Riešenie (ak potrebné):**

```typescript
// Pridať do BasicLayout/LegacyApp
React.useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "unotop:v3" || e.key === "unotop_v3") {
      window.location.reload(); // Reload ak iný tab zmenil dáta
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}, []);
```

### **3. Reset v jednom režime (BASIC), prepnutie na PRO**

✅ **Riešené**: Reset vymaže všetky dáta (vrátane `modeUi`), takže po reload bude BASIC režim (default).

### **4. Browser bez localStorage support**

⚠️ **Fallback**: App bude fungovať, ale neukladá dáta (každý refresh = reset).

- Možno pridať detection + warning banner.

---

## **Testing Checklist**

### **Manual Testing:**

1. **Persistence:**
   - [ ] Vyplniť všetky polia (príjem, výdavky, investície, mix)
   - [ ] Refresh stránku (Ctrl+R)
   - [ ] Overiť že všetky hodnoty ostali

2. **Reset button visibility:**
   - [ ] Desktop: Viditeľné "↻ Reset" v toolbare (vpravo hore)
   - [ ] Mobile: Len ikona "↻" (text skrytý)
   - [ ] Hover: Červené zvýraznenie

3. **Reset confirmation:**
   - [ ] Klik na Reset → popover sa otvorí
   - [ ] Klik mimo → popover sa zatvorí (bez resetovania)
   - [ ] Klik "Zrušiť" → popover sa zatvorí
   - [ ] Klik "Áno, vymazať" → reload + všetky polia prázdne

4. **BASIC vs PRO:**
   - [ ] Reset v BASIC režime funguje
   - [ ] Reset v PRO režime funguje
   - [ ] Po resete sa vráti do BASIC (default)

---

## **Future Improvements (Optional)**

1. **Export/Import settings:**
   - Tlačidlo "Export nastavení" → stiahne JSON
   - Tlačidlo "Import nastavení" → načíta JSON zo súboru

2. **Undo reset:**
   - Backup pred resetom do `localStorage` (napr. `unotop:v3:backup`)
   - Banner "Nastavenia boli resetované. Obnoviť?"

3. **Partial reset:**
   - "Resetovať len portfólio" vs "Resetovať všetko"

4. **Analytics:**
   - Track reset events (koľkokrát users resetujú)
   - Môže indikovať UX problém (ak často)

---

## **Súbory na commit**

```bash
git add src/components/Toolbar.tsx
git add src/BasicLayout.tsx
git add src/LegacyApp.tsx
git add docs/PERSISTENCE_RESET.md
git commit -m "feat(persistence): Auto-save + Reset button

- All inputs persist to localStorage (unotop:v3)
- Reset button in Toolbar (red, confirmation popover)
- Click-outside to close popover
- Clear all data + reload on confirm
- Works in BASIC + PRO modes
- Responsive (icon-only on mobile)

No breaking changes, fully backward compatible."
```

---

**Hotovo!** Refresh stránku a skús:

1. Vyplniť nejaké polia → Refresh → Všetko ostalo ✅
2. Kliknúť Reset → Potvrdiť → Všetko vymazané ✅
