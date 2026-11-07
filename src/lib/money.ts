/** Parse an amount with at most two decimal places into integer minor units. */
export const MAX_MONEY_MINOR_UNITS = 99_999_999_999_999

export function parseMoneyToMinorUnits(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'number' && !Number.isFinite(value)) return null

  const normalized = String(value).trim().replace(',', '.')
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) return null

  const minorUnits = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(minorUnits) && minorUnits <= MAX_MONEY_MINOR_UNITS ? minorUnits : null
}

export function minorUnitsToAmount(minorUnits: number): number {
  return minorUnits / 100
}
