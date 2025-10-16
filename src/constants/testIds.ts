export const TEST_IDS = {
  ETF_WORLD_ACTIVE_SLIDER: 'slider-etf-world-active',
  ETF_WORLD_ACTIVE_INPUT: 'input-etf-world-active',
  DYNAMIC_MANAGEMENT_INPUT: 'input-dynamic-management',
} as const;

export type TestIdKey = keyof typeof TEST_IDS;
