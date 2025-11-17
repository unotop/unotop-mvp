// Central TEST_IDS podľa TOP TIER PROMPT
export const TEST_IDS = {
  ROOT: 'clean-root',
  INSIGHTS_WRAP: 'insights-wrap',
  GOLD_SLIDER: 'slider-gold',
  GOLD_INPUT: 'input-gold-number',
  MONTHLY_SLIDER: 'slider-monthly',
  CHIPS_STRIP: 'scenario-chips',
  SCENARIO_CHIP: 'scenario-chip',
  WIZARD_DIALOG: 'mini-wizard-dialog',
  WIZARD_ACTION_APPLY: 'wizard-apply',
  DEEPLINK_BANNER: 'deeplink-banner',
  
  // PR-4: mixLocked + goal + debts
  CHIP_MIX_LOCKED: 'chip-mix-locked',
  BTN_UNLOCK_MIX: 'btn-unlock-mix',
  GOAL_INPUT: 'goal-input',
  GOAL_SLIDER: 'goal-slider',
  BTN_ADD_DEBT: 'btn-add-debt',
  MODAL_ADD_DEBT: 'modal-add-debt',
  DEBT_TYPE: 'debt-type',
  DEBT_PRINCIPAL: 'debt-principal',
  DEBT_RATE: 'debt-rate',
  DEBT_YEARS: 'debt-years',
  DEBT_EXTRA_MONTHLY: 'debt-extra-monthly',
  // PR-13: EditDebtModal refactor
  EDIT_DEBT_MODAL: 'edit-debt-modal',
  DEBT_TYPE_MORTGAGE: 'debt-type-mortgage',
  DEBT_TYPE_CONSUMER: 'debt-type-consumer',
  DEBT_NAME_INPUT: 'debt-name-input',
  DEBT_PRINCIPAL_INPUT: 'debt-principal-input',
  DEBT_RATE_INPUT: 'debt-rate-input',
  DEBT_YEARS_INPUT: 'debt-years-input',
  DEBT_EXTRA_INPUT: 'debt-extra-input',
  DEBT_SAVE_BTN: 'debt-save-btn',
  DEBT_CANCEL_BTN: 'debt-cancel-btn',
  CHIP_DIRTY_CHANGES: 'chip-dirty-changes',
  CTA_RECOMPUTE: 'cta-recompute',
  
  // PR-5: contact validation
  CONTACT_EMAIL_INPUT: 'contact-email-input',
  CONTACT_PHONE_INPUT: 'contact-phone-input',
  CONTACT_MESSAGE_INPUT: 'contact-message-input', // PR-7
  CONTACT_CONSENT_CHECKBOX: 'contact-consent-checkbox',
  CONTACT_SUBMIT_BTN: 'contact-submit-btn',
  CONTACT_ERROR_SUMMARY: 'contact-error-summary',
  CONTACT_MODAL: 'contact-modal', // PR-7
  CONTACT_MODAL_CLOSE: 'contact-modal-close', // PR-7
  HONEYPOT_COMPANY: 'honeypot-company',
  CONTACT_RATE_LIMIT_HINT: 'contact-rate-limit-hint',
  
  // PR-7: GDPR + StickyBottomBar + InfoMixLine
  PRIVACY_OPEN_LINK: 'privacy-open-link',
  PRIVACY_MODAL: 'privacy-modal',
  PRIVACY_CLOSE_BTN: 'privacy-close-btn',
  FOOTER_PRIVACY_LINK: 'footer-privacy-link',
  
  // PR-13: Footer komponent
  FOOTER: 'footer',
  FOOTER_PRIVACY: 'footer-privacy',
  FOOTER_CONTACT: 'footer-contact',
  
  // PR-8: StickyBottomBar human-readable metrics (nahradenie starých BBAR_*)
  BB_WEALTH: 'bb-wealth',
  BB_YIELD: 'bb-yield',
  BB_DEBT_CLEAR: 'bb-debt-clear',
  BB_RISK: 'bb-risk',
  BB_SUBMIT: 'bb-submit',
  
  // Legacy (zachované pre kompatibilitu, ale nepoužité v PR-8)
  BBAR_FV: 'bbar-fv',
  BBAR_YIELD: 'bbar-yield',
  BBAR_DEBT_CLEAR: 'bbar-debt-clear',
  BBAR_SUM: 'bbar-sum',
  BBAR_PROFILE: 'bbar-profile',
  BBAR_SUBMIT: 'bbar-submit',
  BBAR_CHANGE_MIX: 'bbar-change-mix',
  
  MIXLINE: 'mixline',
  PROFILE_STICKY_BADGE: 'profile-sticky-badge',
  REC_CHANGED_CHIP: 'rec-changed-chip',
} as const;

export type TestIdKey = keyof typeof TEST_IDS;
