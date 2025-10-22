# [Phase-2] Polish spacing/typografia

## Kontext

Phase-1 implementácia je funkčná, ale potrebuje UI polish:

- Spacing consistency (margins, paddings)
- Typography refinement (font sizes, weights, line heights)
- Micro-animations (hover states, focus rings)
- Color consistency (dark theme palette)

## Cieľ

Vyladiť UX/UI na "banking-grade" kvalitu:

- Konzistentné spacing (4px grid: 4, 8, 12, 16, 24, 32, 48)
- Typography scale (12px, 14px, 16px, 18px, 24px, 32px)
- Hover/focus states: subtle animations (transition 150ms)
- Color palette: dokumentovať v `src/styles/theme.ts`

## Akceptačné kritériá

- [ ] Všetky panely majú rovnaké paddingy (`p-4` alebo `p-6`)
- [ ] Typography scale: max 5-6 veľkostí (nie chaos)
- [ ] Hover states: všetky buttons a inputs
- [ ] Focus rings: viditeľné (outline 2px, offset 2px)
- [ ] Dark theme: consistency (žiadne "random" farby)
- [ ] Micro-animations: pulse na slider po Apply (existujúce), expand na cards (nové)

## Súbory na úpravu

- `src/global.css` – typography scale, spacing utilities
- `src/components/*.tsx` – konzistentné Tailwind classes
- `src/styles/theme.ts` – centrálna color palette (nový súbor)
- Dokumentácia: `docs/ui-guidelines.md` (nový súbor)

## Odhadovaný čas

~2-3 hodiny (audit + refactor + dokumentácia)

## Priorita

**Low** – funkčnosť je OK, toto je "nice-to-have" pre profesionálny vzhľad.

## Závislosti

- Phase-1 merge (stabilná UI na ktorej polishovať)

## Dizajn notes

### Spacing scale (Tailwind classes)

- `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px)
- Paddingy v kartách: `p-4` (malé), `p-6` (stredné), `p-8` (veľké)

### Typography scale

- Heading: `text-2xl font-bold` (32px)
- Subheading: `text-xl font-semibold` (24px)
- Body: `text-base` (16px)
- Small: `text-sm` (14px)
- Caption: `text-xs` (12px)

### Color palette (dark theme)

- Background: `#0f172a` (slate-900)
- Surface: `#1e293b` (slate-800)
- Border: `#334155` (slate-700)
- Text primary: `#f1f5f9` (slate-100)
- Text secondary: `#94a3b8` (slate-400)
- Accent: `#3b82f6` (blue-500)
- Success: `#10b981` (green-500)
- Warning: `#f59e0b` (amber-500)
- Error: `#ef4444` (red-500)

### Micro-animations

- Button hover: `transition-colors duration-150`
- Input focus: `transition-shadow duration-150`
- Slider thumb: `transition-transform duration-150 hover:scale-110`
- Card expand: `transition-all duration-300`

## Test IDs

Žiadne nové – toto je len vizuálny refactor.

---

**Labels:** `enhancement`, `phase-2`, `ui-polish`, `typography`, `spacing`
