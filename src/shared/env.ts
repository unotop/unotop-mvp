/**
 * PR-12: Environment detection helpers
 * 
 * Rozlišuje medzi DEV, Preview (Netlify deploy previews) a PROD (production).
 * Používa sa pre:
 * - Admin console guards (?admin=true len v DEV/Preview)
 * - PROD heslo requirement
 * - Debug logging (len v DEV)
 */

/**
 * Check if running in development mode
 * PR-19: Admin console visible LEN s explicitným povolením
 * BEZPEČNÉ: Nič sa nezobrazí automaticky, musíš manuálne zapnúť
 */
export const isDev = (): boolean => {
  if (typeof window === "undefined") return false;
  
  // 1. Explicitný dev režim cez localStorage (manuálne zapnutý)
  const hasDevFlag = localStorage.getItem("unotop_dev_mode") === "true";
  
  // 2. Query param ?dev=true (dočasné zapnutie)
  const hasDevParam = new URLSearchParams(window.location.search).get("dev") === "true";
  
  // Automatic localhost check ODSTRÁNENÝ - admin console len s explicitným povolením
  return hasDevFlag || hasDevParam;
};

/**
 * Check if running in production mode
 */
export const isProd = (): boolean => {
  return import.meta.env.PROD || import.meta.env.MODE === "production";
};

/**
 * Check if running in Netlify deploy preview
 * Preview = nie DEV, nie production domain
 */
export const isPreview = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const hostname = window.location.hostname;
  
  // Netlify deploy previews majú pattern: deploy-preview-XX--<site>.netlify.app
  // alebo branch-deploys: <branch>--<site>.netlify.app
  const isNetlifyPreview = 
    hostname.includes("deploy-preview") || 
    (hostname.includes("netlify.app") && !hostname.includes("unotop.netlify.app"));
  
  return isNetlifyPreview && !isDev();
};

/**
 * Check if URL has ?admin=true flag
 * Funguje len v DEV/Preview (PROD ignoruje)
 */
export const hasAdminUrlFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  
  // PROD guard: ignoruj URL flag v produkcii
  if (isProd() && !isPreview()) {
    console.warn("[env] ?admin=true ignored in PROD");
    return false;
  }
  
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "true";
};

/**
 * Check if admin console should require password
 * PROD = vždy heslo, DEV/Preview = voliteľné (ak nie je ?admin=true)
 */
export const requiresAdminPassword = (): boolean => {
  return isProd() && !isPreview();
};

/**
 * Get current environment name (pre debug)
 */
export const getEnvName = (): "DEV" | "Preview" | "PROD" => {
  if (isDev()) return "DEV";
  if (isPreview()) return "Preview";
  return "PROD";
};
