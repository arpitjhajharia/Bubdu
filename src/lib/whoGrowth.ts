// WHO Child Growth Standards — LMS reference data + math helpers.
//
// Source: WHO Child Growth Standards "expanded tables" (z-scores), parsed from
// the official xlsx files:
//   - wfa_boys_0-to-5-years_zscores.xlsx   (weight-for-age,  capped at 0–24 mo)
//   - lhfa_boys_0-to-2-years_zscores.xlsx  (length-for-age,  0–24 mo, recumbent)
//
// Only BOYS data is bundled (Bubdu is a boy). Girls tables are not included, so
// WHO curves are only drawn when the baby profile sex is 'boy' — see
// `curveData()` / the Growth page, which fall back to plotting raw points only.
//
// Each row holds the Box-Cox L/M/S parameters at a whole month of age. A
// measured value's z-score is:  z = ((value/M)^L - 1) / (L*S)   (L≠0)
// and the value at a target z (used to draw percentile lines) is the inverse.

export interface LMS {
  m: number // age in completed months
  L: number
  M: number
  S: number
}

const AVG_MONTH_DAYS = 30.4375
const WEEK_MONTHS = 7 / AVG_MONTH_DAYS // a week expressed in average months

// Weight-for-age BOYS, weekly 0–13 weeks. Source: wfa_boys_0-to-13-weeks.
const WFA_BOYS_WEEKLY: { w: number; L: number; M: number; S: number }[] = [
  { w: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { w: 1, L: 0.2776, M: 3.4879, S: 0.14483 },
  { w: 2, L: 0.2581, M: 3.7529, S: 0.14142 },
  { w: 3, L: 0.2442, M: 4.0603, S: 0.13807 },
  { w: 4, L: 0.2331, M: 4.3671, S: 0.13497 },
  { w: 5, L: 0.2237, M: 4.659, S: 0.13215 },
  { w: 6, L: 0.2155, M: 4.9303, S: 0.1296 },
  { w: 7, L: 0.2081, M: 5.1817, S: 0.12729 },
  { w: 8, L: 0.2014, M: 5.4149, S: 0.1252 },
  { w: 9, L: 0.1952, M: 5.6319, S: 0.1233 },
  { w: 10, L: 0.1894, M: 5.8346, S: 0.12157 },
  { w: 11, L: 0.184, M: 6.0242, S: 0.12001 },
  { w: 12, L: 0.1789, M: 6.2019, S: 0.1186 },
  { w: 13, L: 0.174, M: 6.369, S: 0.11732 },
]

const WFA_BOYS_MONTHLY: LMS[] = [
  { m: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { m: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
  { m: 2, L: 0.197, M: 5.5675, S: 0.12385 },
  { m: 3, L: 0.1738, M: 6.3762, S: 0.11727 },
  { m: 4, L: 0.1553, M: 7.0023, S: 0.11316 },
  { m: 5, L: 0.1395, M: 7.5105, S: 0.1108 },
  { m: 6, L: 0.1257, M: 7.934, S: 0.10958 },
  { m: 7, L: 0.1134, M: 8.297, S: 0.10902 },
  { m: 8, L: 0.1021, M: 8.6151, S: 0.10882 },
  { m: 9, L: 0.0917, M: 8.9014, S: 0.10881 },
  { m: 10, L: 0.082, M: 9.1649, S: 0.10891 },
  { m: 11, L: 0.073, M: 9.4122, S: 0.10906 },
  { m: 12, L: 0.0644, M: 9.6479, S: 0.10925 },
  { m: 13, L: 0.0563, M: 9.8749, S: 0.10949 },
  { m: 14, L: 0.0487, M: 10.0953, S: 0.10976 },
  { m: 15, L: 0.0413, M: 10.3108, S: 0.11007 },
  { m: 16, L: 0.0343, M: 10.5228, S: 0.11041 },
  { m: 17, L: 0.0275, M: 10.7319, S: 0.11079 },
  { m: 18, L: 0.0211, M: 10.9385, S: 0.11119 },
  { m: 19, L: 0.0148, M: 11.143, S: 0.11164 },
  { m: 20, L: 0.0087, M: 11.3462, S: 0.11211 },
  { m: 21, L: 0.0029, M: 11.5486, S: 0.11261 },
  { m: 22, L: -0.0028, M: 11.7504, S: 0.11314 },
  { m: 23, L: -0.0083, M: 11.9514, S: 0.11369 },
  { m: 24, L: -0.0137, M: 12.1515, S: 0.11426 },
]

// Merged weight curve: weekly points (0–13 wk) then monthly from month 4.
export const WFA_BOYS: LMS[] = [
  ...WFA_BOYS_WEEKLY.map(r => ({ m: +(r.w * WEEK_MONTHS).toFixed(4), L: r.L, M: r.M, S: r.S })),
  ...WFA_BOYS_MONTHLY.filter(r => r.m >= 4),
]

// Length-for-age BOYS, weekly 0–13 weeks (finer resolution for newborns).
// Source: lhfa_boys_0-to-13-weeks_zscores.xlsx. These replace the coarse
// monthly months 0–3 below; from month 4 onward the monthly table is used.
const LHFA_BOYS_WEEKLY: { w: number; L: number; M: number; S: number }[] = [
  { w: 0, L: 1, M: 49.8842, S: 0.03795 },
  { w: 1, L: 1, M: 51.1152, S: 0.03723 },
  { w: 2, L: 1, M: 52.3461, S: 0.03652 },
  { w: 3, L: 1, M: 53.3905, S: 0.03609 },
  { w: 4, L: 1, M: 54.3881, S: 0.0357 },
  { w: 5, L: 1, M: 55.3374, S: 0.03534 },
  { w: 6, L: 1, M: 56.2357, S: 0.03501 },
  { w: 7, L: 1, M: 57.0851, S: 0.0347 },
  { w: 8, L: 1, M: 57.8889, S: 0.03442 },
  { w: 9, L: 1, M: 58.6536, S: 0.03416 },
  { w: 10, L: 1, M: 59.3872, S: 0.03392 },
  { w: 11, L: 1, M: 60.0894, S: 0.03369 },
  { w: 12, L: 1, M: 60.7605, S: 0.03348 },
  { w: 13, L: 1, M: 61.4013, S: 0.03329 },
]

const LHFA_BOYS_MONTHLY: LMS[] = [
  { m: 0, L: 1, M: 49.8842, S: 0.03795 },
  { m: 1, L: 1, M: 54.7244, S: 0.03557 },
  { m: 2, L: 1, M: 58.4249, S: 0.03424 },
  { m: 3, L: 1, M: 61.4292, S: 0.03328 },
  { m: 4, L: 1, M: 63.886, S: 0.03257 },
  { m: 5, L: 1, M: 65.9026, S: 0.03204 },
  { m: 6, L: 1, M: 67.6236, S: 0.03165 },
  { m: 7, L: 1, M: 69.1645, S: 0.03139 },
  { m: 8, L: 1, M: 70.5994, S: 0.03124 },
  { m: 9, L: 1, M: 71.9687, S: 0.03117 },
  { m: 10, L: 1, M: 73.2812, S: 0.03118 },
  { m: 11, L: 1, M: 74.5388, S: 0.03125 },
  { m: 12, L: 1, M: 75.7488, S: 0.03137 },
  { m: 13, L: 1, M: 76.9186, S: 0.03154 },
  { m: 14, L: 1, M: 78.0497, S: 0.03174 },
  { m: 15, L: 1, M: 79.1458, S: 0.03197 },
  { m: 16, L: 1, M: 80.2113, S: 0.03222 },
  { m: 17, L: 1, M: 81.2487, S: 0.0325 },
  { m: 18, L: 1, M: 82.2587, S: 0.03279 },
  { m: 19, L: 1, M: 83.2418, S: 0.0331 },
  { m: 20, L: 1, M: 84.1996, S: 0.03342 },
  { m: 21, L: 1, M: 85.1348, S: 0.03376 },
  { m: 22, L: 1, M: 86.0477, S: 0.0341 },
  { m: 23, L: 1, M: 86.941, S: 0.03445 },
  { m: 24, L: 1, M: 87.8161, S: 0.03479 },
]

// Merged length curve: weekly points (0–13 wk ≈ 0–3 mo) for newborn precision,
// then monthly points from month 4 onward. Keyed by age in (fractional) months.
export const LHFA_BOYS: LMS[] = [
  ...LHFA_BOYS_WEEKLY.map(r => ({ m: +(r.w * WEEK_MONTHS).toFixed(4), L: r.L, M: r.M, S: r.S })),
  ...LHFA_BOYS_MONTHLY.filter(r => r.m >= 4),
]

export type GrowthMetric = 'weight' | 'length'

export const MAX_AGE_MONTHS = 24

// z-scores for the WHO percentile lines we draw (3rd / 15th / 50th / 85th / 97th)
export const PERCENTILE_LINES = [
  { label: '3', z: -1.88079 },
  { label: '15', z: -1.03643 },
  { label: '50', z: 0 },
  { label: '85', z: 1.03643 },
  { label: '97', z: 1.88079 },
]

export function ageInMonths(birthDateMs: number, atMs: number): number {
  return (atMs - birthDateMs) / (AVG_MONTH_DAYS * 86400000)
}

function table(metric: GrowthMetric): LMS[] {
  return metric === 'weight' ? WFA_BOYS : LHFA_BOYS
}

// Linearly interpolate the L/M/S parameters at a fractional month of age.
// Clamps to the table's range (0–24 months).
export function lmsAt(metric: GrowthMetric, months: number): LMS {
  const t = table(metric)
  if (months <= t[0].m) return t[0]
  if (months >= t[t.length - 1].m) return t[t.length - 1]
  let i = 0
  while (i < t.length - 1 && t[i + 1].m <= months) i++
  const a = t[i]
  const b = t[i + 1]
  const f = (months - a.m) / (b.m - a.m)
  return {
    m: months,
    L: a.L + (b.L - a.L) * f,
    M: a.M + (b.M - a.M) * f,
    S: a.S + (b.S - a.S) * f,
  }
}

// Value (kg or cm) at a given z-score for these LMS parameters.
export function valueAtZ({ L, M, S }: LMS, z: number): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L)
}

// z-score for a measured value at a given LMS.
export function zScore({ L, M, S }: LMS, value: number): number {
  return L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S)
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26) → percentile 0–100.
export function zToPercentile(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  if (z > 0) p = 1 - p
  return p * 100
}

// Ordinal-ish label for a percentile, e.g. "50th".
export function percentileLabel(p: number): string {
  const r = Math.round(p)
  const rem100 = r % 100
  const rem10 = r % 10
  let suffix = 'th'
  if (rem100 < 11 || rem100 > 13) {
    if (rem10 === 1) suffix = 'st'
    else if (rem10 === 2) suffix = 'nd'
    else if (rem10 === 3) suffix = 'rd'
  }
  return `${r}${suffix}`
}

export interface CurvePoint { months: number; value: number }

// Generates the WHO percentile curves across 0–MAX_AGE_MONTHS for charting.
// Returns one polyline of points per entry in PERCENTILE_LINES.
export function percentileCurves(metric: GrowthMetric): { label: string; points: CurvePoint[] }[] {
  const t = table(metric)
  return PERCENTILE_LINES.map(({ label, z }) => ({
    label,
    points: t.map(row => ({ months: row.m, value: valueAtZ(row, z) })),
  }))
}

// Computes z-score + percentile for a measurement taken at a given age.
export function evaluate(metric: GrowthMetric, months: number, value: number): { z: number; percentile: number } {
  const lms = lmsAt(metric, Math.max(0, Math.min(months, MAX_AGE_MONTHS)))
  const z = zScore(lms, value)
  return { z, percentile: zToPercentile(z) }
}
