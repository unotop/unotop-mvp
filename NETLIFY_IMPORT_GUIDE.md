# 🚀 NETLIFY IMPORT GUIDE – Posledný krok!

**Status:** ✅ Všetko je pripravené a pushnuté na GitHub  
**Commit:** ce6ce89 (main branch)  
**GitHub URL:** https://github.com/unotop/unotop-mvp

---

## ✅ Čo je hotové (automaticky):

1. ✅ **Merge PRO version** (Phase 1-5) → main branch
2. ✅ **Build test** → `npm run build` SUCCESS (dist/ folder)
3. ✅ **SPA routing fix** → `public/_redirects` pridaný
4. ✅ **Git push** → Všetko nahraté na GitHub
5. ✅ **Tests** → 17/17 PASS (critical suite)

---

## 🎯 Tvoja akcia: Netlify Import (5 minút)

### Krok 1: Otvor Netlify

Choď na: **https://app.netlify.com/**

(Ak nemáš účet, registruj sa cez GitHub – 1 klik)

---

### Krok 2: Importuj projekt

1. Klikni veľké zelené tlačidlo: **"Add new site"**
2. Vyber: **"Import an existing project"**
3. Vyber: **"Deploy with GitHub"**
4. Autorizuj Netlify (ak je to prvý krát)
5. Vyhľadaj: **"unotop-mvp"**
6. Klikni na repo: **unotop/unotop-mvp**

---

### Krok 3: Build Settings (DÔLEŽITÉ!)

Netlify ti ukáže formulár. **Nastav presne takto:**

```
Branch to deploy:          main
Build command:             npm run build
Publish directory:         dist
```

**Nechaj prázdne:**

- Base directory: (prázdne)
- Functions directory: (prázdne)

**Voliteľné (Advanced):**
Klikni "Show advanced" → Add environment variable:

```
NODE_VERSION = 18
```

---

### Krok 4: Deploy!

Klikni veľké tlačidlo: **"Deploy [názov-site]"**

Netlify začne:

1. ⏳ Sťahuje kód z GitHub (10 sec)
2. ⏳ Inštaluje dependencies: `npm install` (1 min)
3. ⏳ Build: `npm run build` (30 sec)
4. ⏳ Publikuje `dist/` na CDN (10 sec)

**Celkovo: ~2-3 minúty**

---

### Krok 5: Máš URL! 🎉

Netlify ti dá náhodný URL:

```
https://sparkly-unicorn-abc123.netlify.app
```

**Otvor ho v browseri** → Tvoja appka je live! 🚀

---

## ✅ Post-Deploy Checklist

Po otvorení URL otestuj:

**BASIC režim (default):**

- [ ] Vidíš emerald "BASIC" toggle (aktívny)
- [ ] Vyber risk profil (Vyvažený)
- [ ] Nastav investičné parametre (4 karty)
- [ ] Vyber portfólio (1 z 3 kariet)
- [ ] Vidíš projekciu (graf + 3 metriky)

**PRO režim:**

- [ ] Prepni na PRO (amber toggle)
- [ ] Vidíš 8 sliderov (mix panel)
- [ ] Tlačidlo "🎯 Optimalizuj" funguje
- [ ] Pridaj dlh → vidíš visual card s amortization
- [ ] Export funguje (stiahne JSON)

**Mobile test:**

- [ ] Otvor na mobile (alebo responsive mode v Chrome DevTools)
- [ ] Všetky sekcie sa zobrazujú správne

---

## 🔧 Ak niečo nefunguje:

### "Build failed" v Netlify logs

**Riešenie:**

1. Choď na Netlify dashboard → Site → Deploys
2. Klikni na failed deploy → "Deploy log"
3. Skontroluj error (zvyčajne chýba Node verzia)
4. Pridaj env var: `NODE_VERSION=18`
5. Trigger redeploy: "Trigger deploy" → "Deploy site"

### "404 Not Found" po refresh

**Status:** Už fixnuté! (`_redirects` súbor je pripravený)

### Bundle warning (622 KB)

**Status:** Známe, nie je to bug. App funguje, len prvé načítanie je pomalšie.

---

## 📝 Finálne info

**GitHub repo:** https://github.com/unotop/unotop-mvp  
**Branch:** main  
**Last commit:** ce6ce89 (fix: \_redirects pre SPA routing)  
**Build command:** `npm run build`  
**Publish dir:** `dist`

**Po deploy-e dostaneš:**

- Production URL (napr. `your-site.netlify.app`)
- Auto-deploy (každý push do `main` → automatický redeploy)
- HTTPS certifikát (automaticky)
- CDN (rýchle načítanie global)

---

## 🎉 To je všetko!

**Tvoja akcia:**

1. Otvor https://app.netlify.com/
2. "Add new site" → "Import from GitHub"
3. Vyber `unotop/unotop-mvp`
4. Build command: `npm run build`, Publish: `dist`
5. Deploy → Čakaj 2 min → Máš URL!

**Done!** 🚀

---

**Pripravil:** AI Assistant  
**Dátum:** 22. október 2025  
**GitHub push:** ✅ Complete (ce6ce89)  
**Status:** READY FOR NETLIFY IMPORT
