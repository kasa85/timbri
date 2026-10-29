export interface DayRules {
  pauseEnabled: boolean;
  pauseAbove: number;
  pauseMinutes: number;
  voucherEnabled: boolean;
  voucherAbove: number;
  voucherPause: number;
}

export interface WorkSettings extends DayRules {
  firstTarget: number;
  secondTarget: number;
  defaultSchedule: 'first' | 'second';
}

export const DEFAULT_RULES: Readonly<DayRules> = {
  pauseEnabled: true, pauseAbove: 360, pauseMinutes: 10,
  voucherEnabled: true, voucherAbove: 360, voucherPause: 30,
};

export const DEFAULT_SETTINGS: Readonly<WorkSettings> = {
  ...DEFAULT_RULES, firstTarget: 360, secondTarget: 540, defaultSchedule: 'second',
};

/** Controlla anche i dati ripristinati, senza accettare durate fuori giornata. */
export function validDayRules(value: unknown): value is DayRules {
  if (!value || typeof value !== 'object') return false;
  const rules = value as DayRules;
  return typeof rules.pauseEnabled === 'boolean' && typeof rules.voucherEnabled === 'boolean'
    && [rules.pauseAbove, rules.pauseMinutes, rules.voucherAbove, rules.voucherPause]
      .every(minutes => Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440);
}

/** Estrae una copia delle sole regole da conservare nella giornata. */
export function dayRules(settings: WorkSettings): DayRules {
  const { pauseEnabled, pauseAbove, pauseMinutes, voucherEnabled, voucherAbove, voucherPause } = settings;
  return { pauseEnabled, pauseAbove, pauseMinutes, voucherEnabled, voucherAbove, voucherPause };
}
