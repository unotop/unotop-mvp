# TODO: Vrchný Toolbar (Menu Bar)

**Priority:** 🔵 Medium (po dokončení logiky Sprint 3-5)  
**Inšpirácia:** Predošlá verzia appky (Netlify)

---

## 🎯 Požiadavky

### Layout:

```
┌────────────────────────────────────────────────────┐
│ [Logo] UNOTOP  │  [Menu items]  │  [User/Share]   │ ← Sticky top
└────────────────────────────────────────────────────┘
```

### Komponenty:

1. **Logo + Názov appky** (ľavá strana)
2. **Menu items** (stred):
   - Profil
   - Investície
   - Mix
   - Projekcia
   - (Optional) PRO režim toggle
3. **Akcie** (pravá strana):
   - Zdieľať
   - (Optional) User avatar / Settings

---

## 🎨 Štýl

- **Dark theme** (konzistentný s appkou)
- **Sticky top** (position: sticky; top: 0; z-index: 1100)
- **Subtle shadow** (oddelenie od obsahu)
- **Mobile responsive** (hamburger menu na mobile)

---

## 🔧 Implementácia (draft)

### Súbory:

- `src/components/Toolbar.tsx` (nový komponent)
- `src/LegacyApp.tsx` (wrap v layout s toolbarom)

### Props:

```typescript
interface ToolbarProps {
  onShareClick: () => void;
  modeUi: "BASIC" | "PRO";
  onModeToggle: () => void;
}
```

---

## 📋 Checkpoint

**Implementovať PO:**

- ✅ Sprint 3 (Optimizer)
- ✅ Sprint 4 (Share modal)
- ✅ Sprint 5 (Debt panel)
  → **Potom Toolbar** (aby sme mali čo linkovať v menu)

---

## 🔗 Odkazy

- Screenshot predošlej verzie: (user nám poskytne)
- Design inspo: Banking apps (Revolut, N26)
