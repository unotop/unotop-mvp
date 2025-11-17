# Stav Projektu UNOTOP MVP – November 14, 2025

## ✅ HOTOVÉ (Production Ready)

### PR-11: ProjectionChart Unification

- ✅ useProjection hook ako single source of truth
- ✅ ProjectionChart refaktorovaný (eliminovaný simulateProjection)
- ✅ Tooltip fix (profit = wealth - invested)
- ✅ Negative year 0 fix
- ✅ 17/17 kritických testov PASS

### PR-12: Lazy Reapply System

- ✅ **Persist meta**: mixOrigin, presetId, profileSnapshot
- ✅ **Drift detection**: thresholdy (lumpSum ±5k/20%, monthly ±100/20%, horizon ±2r/15%)
- ✅ **RecalculateProfileChip**: Amber warning design, CTA, loading state
- ✅ **BETA auto-optimize**: Toggle (default OFF), 1s debounce, BASIC only
- ✅ **PRO protection**: writeMixManual() wrapper, 7x writeV3 replacements
- ✅ **Presun chipu**: Do pravého panelu (viditeľnejšie, medzi graf a metriky)
- ✅ **Blokovanie odoslania**: Ak hasDrift && !autoOptimizeMix → disabled Send Projection + tooltip
- ✅ 12/12 PR-12 testov PASS
- ✅ Build size: 681.53 kB (< 700 kB limit)

### Admin Console (Nov 14)

- ✅ **Ctrl+Shift+P**: Otvára admin konzolu
- ✅ **Heslo**: "BohaKrista20" aktivuje PRO režim
- ✅ **sessionStorage**: Persist unlock (session-only)
- ✅ **Auto-reload**: Po aktivácii refresh page → PRO dostupný

### Core Features (Stable)

- ✅ **BASIC režim**: Simplified UI, portfolio profiles, auto-adjustments
- ✅ **PRO režim**: Full control, manual mix editing, import/export
- ✅ **Portfolio Presets**: Konzervatívny, Vyvážený, Rastový
- ✅ **Mix Adjustments**: Lump sum scaling, monthly capping, stage caps, bond minimums
- ✅ **Drift Detection**: Live tracking s thresholds
- ✅ **Projection Engine**: FV calculation, yield estimation, risk scoring
- ✅ **Privacy & GDPR**: Privacy modal, footer links, consent tracking
- ✅ **Rate Limiting**: 3 submissions/day, cooldown warnings
- ✅ **Email Service**: Netlify function integration
- ✅ **Validation System**: Multi-stage workflow checks

---

## 🔄 V PROCESE (Advisor Review Needed)

### UX Polish (Post-PR-12)

- 📋 **Nápad 1**: TBD (čaká na advisor konzultáciu)
- 📋 **Nápad 2**: TBD (čaká na advisor konzultáciu)
- 📋 **Nápad 3**: TBD (čaká na advisor konzultáciu)

---

## ⏳ BACKLOG (Nízka Priorita)

### Nice-to-Have Features

- [ ] **Debt UI Panel**: Zatiaľ len "Pridať dlh" button (9 testov SKIP)
- [ ] **Chart Legend**: PRO režim enhancement
- [ ] **Export/Import Polish**: Better UX, validation feedback
- [ ] **Onboarding Tour**: Progresívny systém (Basic ready, PRO pending)
- [ ] **Risk Model Refinement**: Advisor data request (docs/risk-model-data-request.md)
- [ ] **Asset Minimums Logic**: Proposal doc ready (docs/ASSET-MINIMUMS-LOGIC-PROPOSAL.md)

### Technical Debt

- [ ] **Bundle Size**: 681 kB → ideálne < 600 kB (dynamic imports)
- [ ] **Test Coverage**: 17 kritických testov, +12 PR-12 → cieľ 50+ full suite
- [ ] **A11y Audit**: RiskGauge meter semantics TODO (noted in tests)
- [ ] **Performance**: Polling reduction (100ms investParams sync → event-based)

---

## 📊 Metriky

### Test Coverage

- ✅ **Kritické testy**: 17/17 PASS
  - invariants.limits (2)
  - accessibility.ui (9)
  - acceptance.mix-cap.ui (3)
  - persist.roundtrip (1)
  - persist.debts.v3 (1)
  - deeplink.banner (1)
- ✅ **PR-12 testy**: 12/12 PASS
  - Drift detection (5)
  - MixOrigin tracking (3)
  - BETA auto-optimize (3)
  - Snapshot update (1)
- ⚠️ **Preskočené**: 9 debt UI testov (očakávané SKIP pre Phase 1)

### Build Stats

- **Index JS**: 681.53 kB (minified), 203.10 kB (gzipped)
- **Index CSS**: 0.51 kB
- **Total HTML**: 0.88 kB
- **Warning**: Chunks > 500 kB (recommendation: dynamic imports)

### Code Quality

- ✅ **TypeScript**: Clean (0 errors)
- ✅ **Linting**: Passing
- ✅ **Git**: feat/pr-7-gdpr-bottom-bar-info-mix branch

---

## 🎯 Ďalšie Kroky

### Immediate (Čaká na User/Advisor)

1. ✅ **User QA**: Scenáre 1-3 (Manual drift, BETA auto, PRO protection) → PASS
2. ✅ **Admin Console**: Ctrl+Shift+P test → WORKING
3. ✅ **Drift Chip Placement**: Pravý panel → DONE
4. ✅ **Send Blocking**: hasDrift → disabled → DONE
5. 📋 **UX Návrhy**: Advisor konzultácia (zopár nápadov na doladenie)

### Short-Term (After Advisor Review)

1. Implementovať UX návrhy (ak schválené)
2. Debt UI panel (ak priorita sa zmení)
3. Bundle size optimization (dynamic imports)
4. Full test suite coverage (cieľ 50+ tests)

### Mid-Term (Next Sprint)

1. Risk model refinement (advisor data input)
2. Asset minimums logic (ak schválené)
3. Chart legend (PRO enhancement)
4. Performance optimizations (event-based sync)

### Long-Term (Future Phases)

1. Mobile app companion
2. Multi-user accounts
3. Historical tracking
4. Advanced analytics

---

## 🔐 Admin Access

**Aktivácia PRO režimu (bez UI prepínača):**

1. Stlač **Ctrl+Shift+P** kdekoľvek v app
2. Zadaj heslo: **BohaKrista20**
3. Klikni "Odomknúť"
4. Page sa reloadne → PRO dostupný

**Deaktivácia:**

- Zatvor session (zavri tab/browser)
- Alebo manuálne clear sessionStorage: `unotop:admin:pro-unlocked`

---

## 📝 Poznámky k Implementácii

### Lazy Reapply Logic

```typescript
// Drift thresholds (OR logic, nie AND)
lumpSum: Math.abs(current - snapshot) >= 5000 ||
  Math.abs(current - snapshot) / snapshot >= 0.2;
monthly: Math.abs(current - snapshot) >= 100 ||
  Math.abs(current - snapshot) / snapshot >= 0.2;
horizon: Math.abs(current - snapshot) >= 2 ||
  Math.abs(current - snapshot) / snapshot >= 0.15;

// Chip shows when:
hasDrift && canReapply && presetId;

// canReapply = mixOrigin === 'presetAdjusted' && !!presetId

// Send Projection blocked when:
hasDrift && !autoOptimizeMix;
```

### Admin Console Behavior

```typescript
// Keyboard shortcut: Ctrl+Shift+P
// Unlock storage: sessionStorage.setItem('unotop:admin:pro-unlocked', 'true')
// Check: isProUnlocked() returns boolean
// Auto-reload after unlock → PRO mode active
```

### PRO Protection

```typescript
// All manual mix edits → mixOrigin = 'manual'
writeMixManual(mix: MixItem[]) {
  writeV3({
    mix,
    mixOrigin: 'manual',
    presetId: undefined,
    profileSnapshot: undefined,
  });
}

// 7x writeV3 calls replaced in MixPanel:
// - Slider changes (useEffect persist)
// - applyGold12, applyRecommended, applyRules
// - Import, Reset, Dorovnať dyn+crypto
```

---

## 🚀 Deployment Checklist (Pre Merge)

- [x] TypeScript clean
- [x] Kritické testy PASS (17/17)
- [x] PR-12 testy PASS (12/12)
- [x] Build < 700 kB
- [x] Admin console working
- [x] Drift chip v pravom paneli
- [x] Send blocking pri drift
- [ ] Advisor review UX návrhov
- [ ] Final QA (user + advisor)
- [ ] Squash commits
- [ ] Update CHANGELOG.md
- [ ] Merge to main

---

**Status:** ✅ Ready for Advisor Review  
**Last Updated:** November 14, 2025  
**Build:** 681.53 kB (production)  
**Tests:** 29/29 PASS (17 critical + 12 PR-12)
