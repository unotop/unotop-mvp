# PR-28 Phase B: Blocking Issue - InvestmentPowerBox sa nerenduje

## Problém

InvestmentPowerBox komponent sa vôbec nezobrazuje v browseri, ani v simplified debug verzii (zelený box s "FUNGUJE!").

## Čo sme vyskúšali

1. ✅ Komponent existuje: `src/features/invest/InvestmentPowerBox.tsx`
2. ✅ Import v InvestSection.tsx je správny
3. ✅ Import v LegacyApp.tsx pridaný
4. ✅ Komponent je v builded bundle (grep potvrdil)
5. ✅ Dev server beží (localhost:8000)
6. ✅ Hard refresh + cache clear
7. ✅ Simplified verzia (len zelený DIV s inline styles)
8. ✅ Debug render priamo v LegacyApp (mimo InvestSection)
9. ❌ `document.querySelector('[data-testid="investment-power-box"]')` → vracia `null`
10. ❌ Žiadny console.log z komponente
11. ❌ Komponent sa nevykresluje ani v červenom debug boxe v LegacyApp

## Aktuálny stav kódu

**LegacyApp.tsx (riadok ~1076-1090):**

```tsx
import InvestmentPowerBox from "./features/invest/InvestmentPowerBox";
import { calculateEffectivePlanVolume } from "./features/portfolio/assetMinima";

// ...

{/* DEBUG: Test InvestmentPowerBox priamo v LegacyApp */}
<div style={{ marginBottom: "1rem", padding: "1rem", border: "2px solid red" }}>
  <h3 style={{ color: "red", marginBottom: "0.5rem" }}>
    DEBUG: InvestmentPowerBox Test
  </h3>
  <InvestmentPowerBox
    effectivePlanVolume={calculateEffectivePlanVolume(...)}
    horizonYears={...}
    monthlyEur={...}
  />
</div>
```

**InvestmentPowerBox.tsx (simplified debug verzia):**

```tsx
export default function InvestmentPowerBox({
  effectivePlanVolume,
  horizonYears,
  monthlyEur,
}: InvestmentPowerBoxProps) {
  return (
    <div
      data-testid="investment-power-box"
      style={{
        padding: "2rem",
        background: "lime",
        color: "black",
        fontSize: "24px",
        fontWeight: "bold",
        border: "5px solid green",
        margin: "1rem 0",
      }}
    >
      ✅ INVESTMENT POWER BOX FUNGUJE!
      <br />
      Volume: {effectivePlanVolume} EUR ...
    </div>
  );
}
```

## Čo používateľ vidí

- Červený debug box **ANO** (viditeľný)
- InvestmentPowerBox **NIE** (ani zelený box, ani nič)
- Žiadne errory v browser console
- querySelector vracia `null`

## Hypotézy

1. **React error boundary** - komponent crashuje a React ho unmountuje (ale žiadny error v console)
2. **TypeScript type mismatch** - calculateEffectivePlanVolume vracia neplatný typ
3. **Import/Export issue** - default export nefunguje správne
4. **CSS/DOM issue** - komponent je hidden/removed CSS
5. **Build cache** - Vite cachuje starý bundle (ale skúšali sme clean build)

## Build info

- Bundle size: 760.98 kB
- Komponent JE v bundle (grep potvrdil "investment-power-box", "Sila vášho plánu")
- TypeScript compilation: 0 errors
- Dev server: Vite 7.2.4, port 8000 (Netlify proxy)

## Next steps potrebné

1. Overenie import/export mechanizmu (named vs default)
2. Check React DevTools - vidí komponent v strome?
3. Check calculateEffectivePlanVolume output - môže vracať NaN/undefined?
4. Try named export namiesto default
5. Check či LegacyApp vôbec renderuje túto časť DOM (možno conditional rendering false?)

## Požiadavka

Potrebujem poradiť čo ďalej - komponent je v kóde, v bundle, ale React ho nevyrenderuje. Žiadne errory, žiadny след v DOM.
