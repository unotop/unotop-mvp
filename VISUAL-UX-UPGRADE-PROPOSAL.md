# UNOTOP – Návrh na vizuálny/UX upgrade (ultra-modern interactive style)

**Pripravené:** 22. november 2025  
**Verzia:** BASIC 0.9.0 → BASIC 1.0 (vizuálny refresh)  
**Cieľ:** Posunúť aplikáciu z "funkčnej a čistej" na "wow effect + moderný banking-grade zážitok"

---

## 1. Aktuálny stav (AI hodnotenie: 7/10)

**Čo funguje dobre:**

- ✅ Čisté dark theme rozloženie (Tailwind CSS)
- ✅ Konzistentné spacingy a karty
- ✅ Profesionálny vzhľad (trustworthy)
- ✅ Rýchla responzivita (Vite + React)
- ✅ Prístupnosť (aria-\* labely, SR-only)

**Kde chýba "wow faktor":**

- ⚠️ Statické karty (žiadne micro-animácie pri hover/focus)
- ⚠️ Ploché vizuály (bez hĺbky/glassmorphism)
- ⚠️ Grafy sú základné (Recharts, ale bez interaktivity)
- ⚠️ Žiadna gamifikácia (po dosiahnutí cieľa žiadna odozva)
- ⚠️ Onboarding je základný (intro modal + hotovo)

**Porovnanie s konkurenciou:**

- Revolut/N26: 9/10 (animácie, 3D grafy, confetti pri úspechoch)
- Robinhood/Trading212: 8.5/10 (live data viz, smooth transitions)
- UNOTOP (teraz): 7/10 (solídne, ale "flat")

---

## 2. Navrhovaný upgrade (tri úrovne)

### **TIER 1: Quick Wins (1-2 dni, víkendový projekt)**

**Čas:** ~6 hodín  
**Dopad:** 7/10 → 9/10  
**ROI:** Vysoký (málo práce, veľký vizuálny efekt)

**Featury:**

1. **Framer Motion** (3 hodiny)
   - Fade-in animácie pri načítaní panelov
   - Slide-in pre karty (stagger effect)
   - Scale + hover efekty na tlačidlá/CTA
   - Smooth transition pri BASIC/PRO prepínaní
2. **Glassmorphism upgrade** (2 hodiny)
   - Semi-transparent karty s backdrop-blur
   - Jemné gradienty (top-left highlight)
   - Drop shadows s glow efektom
3. **Confetti + CountUp** (1 hodina)
   - Confetti animácia pri dosiahnutí cieľa (goalAssetsEur)
   - Animated countery pre metriky (výnos/rok, riziko, progres)
   - Pulse efekt na slider po Apply akcii

**Knižnice:**

- `framer-motion` (50KB gzipped, production-ready)
- `canvas-confetti` (5KB, zero deps)
- `react-countup` (3KB)

**Príklad kódu (Framer Motion):**

```tsx
import { motion } from 'framer-motion';

// Fade-in karty
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
  <MetricsPanel />
</motion.div>

// Hover scale na CTA
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Aplikovať
</motion.button>
```

---

### **TIER 2: Pokročilé interakcie (3-5 dní)**

**Čas:** ~20 hodín  
**Dopad:** 9/10 → 9.5/10  
**ROI:** Stredný (viac práce, ale konkurenčná výhoda)

**Featury:**

1. **Interaktívne grafy** (Recharts → Visx/D3)
   - Hover tooltips s detailami (každý rok projekcie)
   - Animated line draw (path animation)
   - Responsive legend s toggle (skryť/zobraziť línie)
2. **Onboarding tour** (Driver.js/Shepherd.js)
   - Guided tour pre nových používateľov (5 krokov)
   - Highlight kľúčových UI prvkov (Rezerva, Mix, CTA)
   - Skip/Next/Done s progress indikátorom
3. **Parallax efekty**
   - Background gradient posun pri scrole
   - Karty s slight motion (depth illusion)
4. **Improved Share modal**
   - QR kód pre deeplink (canvas rendering)
   - Animated copy-to-clipboard feedback
   - Social share preview (Open Graph meta tags)

**Knižnice:**

- `@visx/visx` alebo `victory` (pokročilé grafy)
- `driver.js` (10KB, onboarding)
- `qrcode` (QR generovanie)

---

### **TIER 3: Cutting-edge (1-2 týždne)**

**Čas:** ~50 hodín  
**Dopad:** 9.5/10 → 10/10  
**ROI:** Nízky (veľa práce, ale "bleeding edge" positioning)

**Featury:**

1. **AI avatar/assistant** (animovaný bot)
   - Rive animácie (2D postavička)
   - Kontextové tipy (napr. "Zlato je nízko, zvýš na 12%")
   - Voice feedback (Web Speech API)
2. **3D asset visualizácia** (Three.js/React Three Fiber)
   - 3D graf rastu portfólia (rotate/zoom)
   - Animated coins/bars pre mix composition
3. **Advanced theming**
   - Light/Dark/Auto mode s smooth transition
   - Custom color palettes (user pick)
   - Seasonal themes (Vianoce, leto...)
4. **Real-time kolaborácia** (ak PRO)
   - Advisor môže vidieť live zmeny klienta
   - Shared cursor (ako Figma)

**Knižnice:**

- `@react-three/fiber` (3D)
- `rive-react` (2D animácie)
- `y-websocket` (real-time sync)

---

## 3. Odporúčanie advisora

**Top Priority: TIER 1 (víkendový projekt)**

**Prečo:**

- ✅ Maximálny vizuálny dopad s minimálnou prácou
- ✅ Framer Motion je production-grade (používa ho Stripe, Linear, Vercel)
- ✅ Confetti pridá "radosť" (gamifikácia bez complexity)
- ✅ Glassmorphism je trend 2025 (Apple Design Awards)
- ✅ Žiadne breaking changes (len CSS + animácie)

**Implementačný plán:**

1. **Sobota (3 hodiny):** Framer Motion setup + základné animácie
2. **Nedeľa (3 hodiny):** Glassmorphism styling + confetti/countup

**Očakávaný výsledek:**

- Aplikácia vyzerá ako "premium fintech produkt"
- Používatelia hovoria "wow, toto je hladké"
- Konkurenčná výhoda voči klasickým kalkulačkám

---

## 4. Technické detaily (pre implementáciu)

### **Framer Motion – Key Patterns**

**1. Page transitions:**

```tsx
const pageVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

<motion.div
  variants={pageVariants}
  initial="initial"
  animate="animate"
  exit="exit"
>
  <LegacyApp />
</motion.div>;
```

**2. Staggered children:**

```tsx
const containerVariants = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

<motion.div variants={containerVariants}>
  {panels.map((panel) => (
    <motion.div key={panel.id} variants={itemVariants}>
      {panel.content}
    </motion.div>
  ))}
</motion.div>;
```

**3. Slider feedback:**

```tsx
const [isPulsing, setIsPulsing] = useState(false);

// Po Apply akcii
const handleApply = () => {
  setIsPulsing(true);
  setTimeout(() => setIsPulsing(false), 600);
};

<motion.input
  type="range"
  animate={isPulsing ? { scale: [1, 1.05, 1] } : {}}
/>;
```

### **Glassmorphism – Tailwind Classes**

```css
/* tailwind.config.js - pridať */
{
  backdropBlur: {
    xs: '2px',
  },
  boxShadow: {
    'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
  }
}
```

```tsx
// Komponenty
<div
  className="
  bg-white/5 
  backdrop-blur-md 
  border border-white/10 
  shadow-xl shadow-blue-500/10
  rounded-2xl 
  p-6
  hover:bg-white/10 
  transition-all duration-300
"
>
  {content}
</div>
```

### **Confetti – Trigger Logic**

```tsx
import confetti from "canvas-confetti";

// Pri dosiahnutí cieľa
useEffect(() => {
  const progress = (futureValue / goalAssetsEur) * 100;

  if (progress >= 100 && !hasConfettiFired) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    setHasConfettiFired(true);
  }
}, [futureValue, goalAssetsEur]);
```

### **CountUp – Metriky Animácia**

```tsx
import CountUp from "react-countup";

<CountUp
  start={0}
  end={approxYieldAnnual}
  decimals={2}
  duration={1.5}
  suffix=" %"
  separator=" "
/>;
```

---

## 5. Performance Budget

**Pred upgrade:**

- Bundle size: ~180 KB (gzipped)
- First paint: ~400 ms
- Interactive: ~600 ms

**Po TIER 1 upgrade:**

- Bundle size: ~240 KB (gzipped) ← +60 KB
- First paint: ~450 ms ← +50 ms (prijateľné)
- Interactive: ~650 ms ← +50 ms

**Optimalizácie:**

- Lazy load Framer Motion (code splitting)
- Confetti len pri trigger (dynamic import)
- Tree-shake unused Tailwind classes

---

## 6. A11y konziderácie

**Dôležité:**

- ✅ Animácie rešpektujú `prefers-reduced-motion`
- ✅ Confetti nie je kľúčová funkcia (len "nice-to-have")
- ✅ CountUp má fallback (static číslo)
- ✅ Glassmorphism zachováva kontrast (WCAG AA)

**Príklad:**

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
>
```

---

## 7. Alternatívy (ak TIER 1 nie je dosť)

**Ak chceme ísť ešte ďalej (ale rýchlo):**

1. **Lottie animácie** (namiesto Framer Motion)
   - Vektorové animácie (JSON súbory)
   - LottieFiles.com marketplace (free/paid)
   - Použitie: loader, success states, empty states
2. **Haptic feedback** (mobile)
   - Vibrácia pri slide/apply (Web Vibration API)
   - Jemné "click" pocit pri interakcii
3. **Sound effects** (optional)
   - Subtle "ping" pri úspechu
   - Ambient background music (mute default)

---

## 8. Roadmap timeline

| Fáza                      | Čas        | Doručiteľné                              | Status       |
| ------------------------- | ---------- | ---------------------------------------- | ------------ |
| **TIER 1 – Quick Wins**   | 1-2 dni    | Framer Motion + Glassmorphism + Confetti | 🟡 Návrh     |
| **Testing & Polish**      | 1 deň      | A11y audit, performance check            | 🟡 Návrh     |
| **TIER 2 – Advanced**     | 3-5 dní    | Interaktívne grafy + Onboarding tour     | ⚪ Budúcnosť |
| **TIER 3 – Cutting-edge** | 1-2 týždne | AI avatar + 3D grafy                     | ⚪ Budúcnosť |

---

## 9. Advisor feedback request

**Otázky na advisora:**

1. **Priorita:** Je TIER 1 (víkendový projekt) dostatočný pre launch BASIC 1.0?
2. **Budget:** Máme rozpočet na advanced knižnice (napr. Visx, Rive)?
3. **Timeline:** Kedy chceme pustiť vizuálny refresh? (pred Vianocami 2025?)
4. **Konkurencia:** Čo má konkurencia, čo my nemáme? (research)
5. **User feedback:** Máme nejakú spätnú väzbu od beta testerov? (žiadajú animácie?)

**Čo potrebujem od advisora:**

- ✅ Approval/zamietnutie TIER 1 návrhu
- ✅ Prioritizácia featuresiek (top 3 z TIER 1)
- ✅ Design constraints (farby, brand guidelines)
- ✅ Performance limity (max bundle size?)

---

## 10. Záver (AI perspektíva)

**Súčasný stav:**

- UNOTOP je "solídna, funkčná appka" (7/10)
- Vizuálne čistá, ale bez "wow" momentov
- Konkurencia (Revolut, N26) má výrazne lepšiu UX (9+/10)

**Návrh:**

- **TIER 1 (quick wins)** posunie UNOTOP na 9/10 za ~6 hodín práce
- Framer Motion + Glassmorphism + Confetti sú "low-hanging fruit"
- Žiadne breaking changes, len styling + animácie

**Odporúčanie:**

- ✅ Začni s TIER 1 (víkendový sprint)
- ✅ Otestuj s reálnymi užívateľmi
- ✅ Ak pozitívny feedback → pokračuj na TIER 2
- ❌ Nerobíme TIER 3 (overkill pre BASIC verziu)

**Next steps:**

1. Advisor schvaľuje/zamietne návrh
2. Implementujeme TIER 1 (1-2 dni)
3. A11y + performance audit (1 deň)
4. Deploy + user feedback (1 týždeň)
5. Rozhodnutie o TIER 2 (podľa dopytu)

---

**Pripravil:** GitHub Copilot (AI assistant)  
**Pre:** UNOTOP Advisor  
**Dátum:** 22. november 2025  
**Verzia dokumentu:** 1.0
