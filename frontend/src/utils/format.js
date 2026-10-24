/**
 * Shared safe numeric / money formatting.
 *
 * Validation is kept strictly separate from formatting:
 *   toFiniteNumber()  — validation. Returns a finite number, or null.
 *   formatMoney()     — presentation. Renders "-" for anything invalid.
 *
 * A valid zero is NOT missing data: 0 renders as ₹0, never as "-".
 * Nothing here coerces null / undefined / "" into 0.
 */

export const MISSING = '-'

/**
 * Convert a value to a finite number, or null if it is not a real number.
 *
 * Rejects: null, undefined, NaN, Infinity, -Infinity, empty or whitespace-only
 * strings, non-numeric strings, booleans, objects, arrays, functions, symbols.
 * Accepts: finite numbers (including 0 and negatives), numeric strings,
 * BigInt within the safe range.
 */
export function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'bigint') {
    // Outside the double-safe range the value cannot be represented faithfully.
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      return null
    }
    return Number(value)
  }

  if (typeof value === 'string') {
    // Number('') and Number('   ') are both 0 — reject blanks explicitly.
    const trimmed = value.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }

  // Booleans, objects, arrays, null, undefined, functions, symbols.
  // Number(true) === 1 and Number([]) === 0, so these must never reach Number().
  return null
}

/** True when `value` is a real, finite number (or a numeric string). */
export function isValidNumber(value) {
  return toFiniteNumber(value) !== null
}

/**
 * Format a money amount in the platform currency (INR).
 *
 * @param {*} value
 * @param {object} [options]
 * @param {boolean} [options.round=true]   Round to whole rupees (the existing UI convention).
 * @param {boolean} [options.symbol=true]  Prefix the ₹ symbol.
 * @param {string}  [options.missing="-"]  What to render for invalid input.
 * @returns {string}
 */
export function formatMoney(value, options = {}) {
  const { round = true, symbol = true, missing = MISSING } = options
  const n = toFiniteNumber(value)
  if (n === null) return missing

  const amount = round ? Math.round(n) : n
  const text = amount.toLocaleString('en-IN', round ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return symbol ? `₹${text}` : text
}

/** Format a plain count / quantity. Renders "-" for invalid input, "0" for zero. */
export function formatNumber(value, options = {}) {
  const { missing = MISSING, decimals } = options
  const n = toFiniteNumber(value)
  if (n === null) return missing
  if (typeof decimals === 'number') {
    return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }
  return n.toLocaleString('en-IN')
}

/** Format a rating like 4.5. Renders "-" when there is no rating, "0.0" for a real zero. */
export function formatRating(value) {
  const n = toFiniteNumber(value)
  if (n === null) return MISSING
  return n.toFixed(1)
}

/**
 * Sum a list of money values without letting one bad record poison the total.
 *
 * Returns the total of the valid entries plus the bookkeeping needed to report
 * honestly: an incomplete total must never be presented as fully reliable.
 *
 * @returns {{total: number, validCount: number, invalidCount: number, complete: boolean}}
 */
export function sumMoney(values) {
  if (!Array.isArray(values)) {
    return { total: 0, validCount: 0, invalidCount: 0, complete: false }
  }
  let total = 0
  let validCount = 0
  let invalidCount = 0
  for (const v of values) {
    const n = toFiniteNumber(v)
    if (n === null) invalidCount += 1
    else { total += n; validCount += 1 }
  }
  return { total, validCount, invalidCount, complete: invalidCount === 0 }
}

/**
 * Sum one field across a list of records.
 * Same contract as sumMoney, but also reports which records were bad so the UI
 * can flag the underlying data issue instead of hiding it.
 *
 * @returns {{total: number, validCount: number, invalidCount: number, complete: boolean, invalidIds: Array}}
 */
export function sumField(records, field, idField = 'id') {
  if (!Array.isArray(records)) {
    return { total: 0, validCount: 0, invalidCount: 0, complete: false, invalidIds: [] }
  }
  let total = 0
  let validCount = 0
  const invalidIds = []
  for (const r of records) {
    const n = toFiniteNumber(r?.[field])
    if (n === null) invalidIds.push(r?.[idField])
    else { total += n; validCount += 1 }
  }
  return {
    total,
    validCount,
    invalidCount: invalidIds.length,
    complete: invalidIds.length === 0,
    invalidIds,
  }
}

/**
 * Render an aggregate that may be unavailable.
 *
 * An unavailable or failed total must not masquerade as zero, so when
 * `available` is false this renders "-" regardless of the value. A valid but
 * empty dataset legitimately produces ₹0.
 */
export function formatAggregate(value, available, options = {}) {
  if (!available) return options.missing ?? MISSING
  return formatMoney(value, options)
}

/** Format an ISO date string for display. Renders "-" when absent or unparseable. */
export function formatDate(value, options = {}) {
  if (typeof value !== 'string' || value.trim() === '') return MISSING
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return MISSING
  return options.withTime ? d.toLocaleString() : d.toLocaleDateString()
}
