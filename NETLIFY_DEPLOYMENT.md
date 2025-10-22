# 🚀 UNOTOP MVP – NETLIFY DEPLOYMENT GUIDE

**Build Status:** ✅ SUCCESS  
**Build Date:** 22. október 2025  
**Branch:** main (merged from feat/legacy-basic)  
**Version:** 0.6.0-beta  

---

## 📦 Build Output

```
dist/index.html                   0.86 kB │ gzip:   0.47 kB
dist/assets/index-DWnUPmmY.css    0.51 kB │ gzip:   0.32 kB
dist/assets/index-BFQpgWTK.js   622.95 kB │ gzip: 184.23 kB
```

**Poznámka:** Bundle je veľký (622 KB) kvôli Recharts + React. Post-launch optimalizácia: code-splitting.

---

## 🌐 Netlify Deploy Kroky

### 1. Push do GitHub
```bash
git push origin main
```

### 2. Netlify Site Settings
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Node Version:** 18.x (alebo 20.x)

### 3. Environment Variables (ak sú potrebné)
```
NODE_ENV=production
```

### 4. Deploy
Netlify automaticky deployuje pri push-e do `main`.

### 5. Custom Domain (voliteľné)
- Nastaviť v Netlify: Site settings → Domain management
- DNS: CNAME record → `your-site.netlify.app`

---

## ✅ Pre-Deploy Checklist

- [x] **Build úspešný:** `npm run build` ✅
- [x] **Critical tests:** 17/17 PASS ✅
- [x] **A11y tests:** 9/9 PASS ✅
- [x] **UX analýza:** 8.5/10 (See UX_ANALYSIS.md) ✅
- [x] **Merge do main:** ✅ Complete
- [x] **Git push:** Pending (user action)

---

## 🧪 Post-Deploy Testing

### 1. Basic User Flow
1. Open site → BASIC mode (default)
2. Select risk profile (Vyvažený)
3. Set investment params (4 cards)
4. Choose portfolio (1 of 3 presets)
5. View projection (graph + metrics)

### 2. PRO User Flow
1. Toggle to PRO mode (header)
2. Adjust mix with sliders (8 assets)
3. Add debt → see visual card + amortization
4. Export configuration (JSON)
5. Optimize mix (🎯 Optimalizuj button)

### 3. Mobile Responsiveness
- Test na iOS Safari + Android Chrome
- Všetky komponenty by mali byť responsive

### 4. Performance
- Lighthouse score: Target 90+ (Desktop), 80+ (Mobile)
- Bundle size warning: Známe (code-splitting post-MVP)

---

## 📊 Release Summary

### Features Deployed

**BASIC Režim:**
- ✅ Risk profile selection (radio buttons)
- ✅ Visual cards (2×2 grid investičné nastavenia)
- ✅ 3 portfolio presets (konzervativne/vyvažene/dynamicky)
- ✅ Projection graph (3 curves: investície, dlhy, čistý)
- ✅ Metric cards (Výnos, Riziko, Progres)
- ✅ Simple debt table

**PRO Režim:**
- ✅ Mix panel (8 asset sliders)
- ✅ Actions: Optimalizuj, Export/Import, Dorovnať, Rules
- ✅ Visual debt cards (amortization insights)
- ✅ Status chips (live feedback)
- ✅ Advanced controls

**UX Improvements:**
- ✅ BASIC/PRO toggle (sticky header)
- ✅ Default risk profile (Vyvažený)
- ✅ Tooltip pre debt table (BASIC)
- ✅ Share button + modal
- ✅ Deep-link support

**Bugfixes:**
- ✅ Voľné prostriedky: live localStorage read
- ✅ Optimalizuj button: accessible name
- ✅ All critical tests passing

---

## 🔧 Known Issues (Post-MVP)

1. **Bundle Size:** 622 KB (optimalizácia: dynamic imports)
2. **Onboarding Tour:** Chýba guided tour pre nováčikov (nice-to-have)
3. **Welcome Banner:** Žiadny first-time user guide (post-launch)
4. **Progress Indicator:** Chýba "Krok X/4" (future enhancement)

---

## 📈 Next Steps (Post-Launch)

### Phase 6: Optimization
1. Code-splitting (dynamic imports)
2. Lazy load Recharts
3. Image optimization

### Phase 7: Onboarding
1. Welcome banner (localStorage flag)
2. Tooltip tour (react-joyride)
3. Progress indicator

### Phase 8: Analytics
1. Google Analytics / Plausible
2. User flow tracking
3. A/B testing (BASIC vs PRO default)

---

## 📞 Support & Monitoring

**Production URL:** `https://your-site.netlify.app` (TBD)  
**Status Page:** Netlify Dashboard  
**Error Tracking:** Browser console (post-MVP: Sentry)  

**User Support:**
- GitHub Issues: Bug reports
- Email: (TBD)
- FAQ: (TBD)

---

## 🎉 Deployment Success Criteria

- [x] Build completes without errors ✅
- [x] Critical tests pass ✅
- [x] UX analysis complete (8.5/10) ✅
- [x] Merge to main ✅
- [ ] Netlify deployment ⏳ (awaiting user)
- [ ] Post-deploy smoke test ⏳
- [ ] Production URL live ⏳

---

**Status:** READY TO DEPLOY 🚀

**Next Action:** Push to GitHub → Netlify auto-deploys → Smoke test

**Pripravil:** AI Assistant  
**Dátum:** 22. október 2025  
**Session Commits:** 8 (d4c758d)  
**Merge Commit:** Latest on main
