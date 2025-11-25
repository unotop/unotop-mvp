# PR-26: fix(graph): debt graph reactivity after adding debt

## Problém

Debt graph sa neaktualizoval po pridaní dlhu - vyžadoval page refresh.

## Riešenie

- Pass `debts` ako prop z `BasicLayout` do `BasicProjectionPanel`
- `useProjection` hook dostáva reaktívne debts → okamžitá aktualizácia grafu

## Technické zmeny

### src/BasicLayout.tsx

```tsx
<BasicProjectionPanel
  mix={mix}
  debts={v3ForDrift.debts || []} // PR-26: Pass for reactivity
  // ... other props
/>
```

### src/features/overview/BasicProjectionPanel.tsx

```tsx
interface BasicProjectionPanelProps {
  // ... existing
  debts?: Array<{id, name, principal, ratePa, monthly, monthsLeft?}>;
}

export const BasicProjectionPanel = ({ ..., debts = [] }) => {
  // PR-26: Use prop instead of internal readV3()
  const projection = useProjection({
    // ...
    debts,  // Reactive!
  });
}
```

## CI/Netlify fixes (infraštruktúra)

### .github/workflows/ci.yml

- Pridané `permissions` (issues, pull-requests) pre PR comments
- Clean install: `rm -rf node_modules package-lock.json && npm install`
- Fix pre npm optional dependencies bug

### netlify.toml

- Clean install: `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps`
- Fix pre `@rollup/rollup-linux-x64-gnu MODULE_NOT_FOUND` error

## Testing

- ✅ Build: PASS lokálne (`npm run build`)
- ✅ CI: PASS (critical tests)
- 🔲 Manual: Pridať dlh → graf update bez refresh (user testing)

## Related Issues

Fixes npm optional dependencies bug: https://github.com/npm/cli/issues/4828

## Commits

- `a4d4fe2` - Main fix (debt graph reactivity)
- `6db9bc5` - CI: regenerate package-lock.json
- `a53123e` - Style: formatter cleanup
- `c6f0610` - CI: trigger rebuild (cache bust attempt)
- `0f472b2` - CI: clean install workflow
- `252c6bd` - CI: permissions for PR comments
- `f8cdb93` - Netlify: clean install fix

## Deploy

Po merge → Netlify auto-deploy main branch → production
