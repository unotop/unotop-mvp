/**
 * useReCaptcha Hook
 * 
 * reCAPTCHA v3 integration - invisible bot detection.
 * Execute before form submissions to get token for server-side verification.
 * 
 * PR-23: Security Hardening
 * PR-25: Feature flag support (VITE_ENABLE_RECAPTCHA)
 */

import { useEffect, useState } from 'react';

interface ReCaptchaAPI {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: ReCaptchaAPI;
  }
}

/**
 * Hook pre reCAPTCHA v3 token generation
 * 
 * @returns {Object} { execute, isReady }
 * @example
 * const { execute, isReady } = useReCaptcha();
 * 
 * if (isReady) {
 *   const token = await execute('submit_projection');
 *   // Include token in API call
 * }
 */
export function useReCaptcha() {
  const [isReady, setIsReady] = useState(false);
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const isEnabled = import.meta.env.VITE_ENABLE_RECAPTCHA !== "false"; // PR-25: Feature flag

  useEffect(() => {
    // PR-25: Skip reCAPTCHA initialization if disabled (BASIC mode)
    if (!isEnabled) {
      console.log('[reCAPTCHA] Disabled via VITE_ENABLE_RECAPTCHA flag');
      setIsReady(false); // Explicitly set to false
      return;
    }

    // Check if reCAPTCHA script loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsReady(true);
      });
    } else {
      // Fallback: wait for script load
      const checkReady = setInterval(() => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(() => {
            setIsReady(true);
          });
          clearInterval(checkReady);
        }
      }, 100);

      return () => clearInterval(checkReady);
    }
  }, [isEnabled]);

  /**
   * Execute reCAPTCHA and get token
   * 
   * @param {string} action - Action name (e.g., 'submit_projection')
   * @returns {Promise<string>} Token for server-side verification
   */
  const execute = async (action: string): Promise<string> => {
    // PR-25: Return empty token if disabled (graceful degradation)
    if (!isEnabled) {
      console.log('[reCAPTCHA] Execution skipped (disabled)');
      return '';
    }

    if (!isReady || !window.grecaptcha) {
      console.warn('[reCAPTCHA] Not ready, returning empty token');
      return '';
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action });
      return token;
    } catch (error) {
      console.error('[reCAPTCHA] Execution failed:', error);
      return '';
    }
  };

  return { execute, isReady };
}

