/**
 * useReCaptcha Hook
 * 
 * reCAPTCHA v3 integration - invisible bot detection.
 * Execute before form submissions to get token for server-side verification.
 * 
 * PR-23: Security Hardening
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

  useEffect(() => {
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
  }, []);

  /**
   * Execute reCAPTCHA and get token
   * 
   * @param {string} action - Action name (e.g., 'submit_projection')
   * @returns {Promise<string>} Token for server-side verification
   */
  const execute = async (action: string): Promise<string> => {
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
