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
  DEEPLINK_BANNER: 'deeplink-banner'
} as const;

export type TestIdKey = keyof typeof TEST_IDS;
