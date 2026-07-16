import calibration from '../data/generated/calibration.json'

/**
 * Empirical calibration consumed by the engine (built offline by pipeline/):
 *
 * - Goal timing: real goals cluster late in each half. The per-minute chance
 *   rate is multiplied by the observed 5-minute-bin factor (mean 1 within
 *   regulation and within extra time, so total volume is unchanged).
 * - Conversion: StatsBomb WC2022 knockout shots set the mean chance quality
 *   (xG/shot) and the on-target share of non-goal shots.
 * - Shootout: per-kick base conversion (see calibration.json provenance).
 */

const reg = calibration.goalMinutes.regulationFactors
const et = calibration.goalMinutes.extraTimeFactors

export function goalMinuteFactor(minute: number): number {
  if (minute <= 90) return reg[Math.min(Math.floor((minute - 1) / 5), reg.length - 1)] ?? 1
  return et[Math.min(Math.floor((minute - 91) / 5), et.length - 1)] ?? 1
}

export const SHOOTOUT_BASE_CONVERSION = calibration.shootout.baseConversion

/** Mean xG per shot observed in real knockout football. */
export const EMPIRICAL_XG_PER_SHOT = calibration.conversion?.xgPerShot ?? 0.12

/**
 * P(shot is on target | it did not score), derived from the observed
 * on-target share and scoring rate: (onTarget − goals) / (1 − goals).
 */
export const EMPIRICAL_ON_TARGET_GIVEN_MISS = calibration.conversion
  ? Math.round(
      ((calibration.conversion.onTargetShare - calibration.conversion.shotsToGoals) /
        (1 - calibration.conversion.shotsToGoals)) *
        1000,
    ) / 1000
  : 0.38

export const CALIBRATION_META = calibration.meta
export const CONVERSION_SAMPLE = calibration.conversion ?? null
