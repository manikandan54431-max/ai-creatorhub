/**
 * Unit tests for the shared safe numeric formatting (Issue 6).
 *
 * Uses the Node built-in test runner — no extra dependency:
 *   node --test tests/unit/
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MISSING,
  toFiniteNumber,
  isValidNumber,
  formatMoney,
  formatNumber,
  formatRating,
  sumMoney,
  sumField,
  formatAggregate,
  formatDate,
} from '../../src/utils/format.js'

// ── Valid numbers ───────────────────────────────────────────────────────────

test('formats ordinary amounts', () => {
  assert.equal(formatMoney(1500), '₹1,500')
  assert.equal(formatMoney(999999), '₹9,99,999')   // Indian digit grouping
  assert.equal(formatMoney(1234.56), '₹1,235')     // rounds by default
})

test('formats large amounts without loss', () => {
  assert.equal(formatMoney(1234567890), '₹1,23,45,67,890')
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER), formatMoney(9007199254740991))
})

test('preserves a valid zero in the normal currency format', () => {
  assert.equal(formatMoney(0), '₹0')
  assert.equal(formatMoney('0'), '₹0')
  assert.equal(formatMoney(0.0), '₹0')
  assert.notEqual(formatMoney(0), MISSING)
})

test('handles negative values where allowed', () => {
  assert.equal(formatMoney(-500), '₹-500')
  assert.equal(toFiniteNumber(-0.5), -0.5)
})

test('accepts numeric strings', () => {
  assert.equal(formatMoney('2500'), '₹2,500')
  assert.equal(formatMoney('2500.75'), '₹2,501')
  assert.equal(formatMoney(' 100 '), '₹100')   // surrounding whitespace is fine
  assert.equal(formatMoney('-42'), '₹-42')
  assert.equal(formatMoney('1e3'), '₹1,000')
})

test('renders two decimals when rounding is disabled', () => {
  assert.equal(formatMoney(1234.5, { round: false }), '₹1,234.50')
})

test('can omit the currency symbol', () => {
  assert.equal(formatMoney(1500, { symbol: false }), '1,500')
})

// ── Invalid values all render "-" ───────────────────────────────────────────

test('renders "-" for null and undefined', () => {
  assert.equal(formatMoney(null), '-')
  assert.equal(formatMoney(undefined), '-')
  assert.equal(formatMoney(), '-')
})

test('renders "-" for empty and whitespace-only strings', () => {
  assert.equal(formatMoney(''), '-')
  assert.equal(formatMoney('   '), '-')
  assert.equal(formatMoney('\t\n'), '-')
})

test('renders "-" for non-numeric strings', () => {
  assert.equal(formatMoney('abc'), '-')
  assert.equal(formatMoney('12abc'), '-')
  assert.equal(formatMoney('₹1,500'), '-')   // already-formatted text is not a number
  assert.equal(formatMoney('NaN'), '-')
})

test('renders "-" for NaN and the infinities', () => {
  assert.equal(formatMoney(NaN), '-')
  assert.equal(formatMoney(0 / 0), '-')
  assert.equal(formatMoney(Infinity), '-')
  assert.equal(formatMoney(-Infinity), '-')
  assert.equal(formatMoney(1 / 0), '-')
})

test('renders "-" for invalid types, never coercing them to a number', () => {
  // Number(true) === 1, Number([]) === 0, Number([5]) === 5 — all must be rejected.
  assert.equal(formatMoney(true), '-')
  assert.equal(formatMoney(false), '-')
  assert.equal(formatMoney([]), '-')
  assert.equal(formatMoney([5]), '-')
  assert.equal(formatMoney({}), '-')
  assert.equal(formatMoney({ amount: 5 }), '-')
  assert.equal(formatMoney(() => 5), '-')
})

test('the missing placeholder is overridable', () => {
  assert.equal(formatMoney(null, { missing: 'n/a' }), 'n/a')
})

// ── Validation is separate from formatting ──────────────────────────────────

test('toFiniteNumber returns a number or null, never NaN', () => {
  assert.equal(toFiniteNumber(42), 42)
  assert.equal(toFiniteNumber('42'), 42)
  assert.equal(toFiniteNumber(0), 0)
  assert.equal(toFiniteNumber(null), null)
  assert.equal(toFiniteNumber(''), null)
  assert.equal(toFiniteNumber(NaN), null)
  assert.equal(toFiniteNumber(Infinity), null)
  assert.equal(toFiniteNumber(true), null)
})

test('isValidNumber treats zero as valid, not missing', () => {
  assert.equal(isValidNumber(0), true)
  assert.equal(isValidNumber('0'), true)
  assert.equal(isValidNumber(null), false)
  assert.equal(isValidNumber(''), false)
  assert.equal(isValidNumber(NaN), false)
})

test('bigint within the safe range is accepted, outside it is rejected', () => {
  assert.equal(toFiniteNumber(123n), 123)
  assert.equal(toFiniteNumber(10n ** 30n), null)
})

// ── Aggregates ──────────────────────────────────────────────────────────────

test('sumMoney never produces NaN from a bad entry', () => {
  const r = sumMoney([100, '200', null, undefined, NaN, '', 300])
  assert.equal(r.total, 600)         // 100 + '200' + 300
  assert.equal(r.validCount, 3)
  assert.equal(r.invalidCount, 4)    // null, undefined, NaN, ''
  assert.equal(r.complete, false)
  assert.ok(!Number.isNaN(r.total))
})

test('a fully valid dataset reports a complete total', () => {
  const r = sumMoney([100, 200, 0])
  assert.equal(r.total, 300)
  assert.equal(r.complete, true)
})

test('a valid empty dataset legitimately totals zero', () => {
  const r = sumMoney([])
  assert.equal(r.total, 0)
  assert.equal(r.complete, true)
  assert.equal(formatAggregate(r.total, true), '₹0')
})

test('sumMoney on a non-array reports incomplete rather than zero', () => {
  const r = sumMoney(null)
  assert.equal(r.complete, false)
})

test('sumField identifies which records carry invalid values', () => {
  const rows = [
    { id: 1, amount: 100 },
    { id: 2, amount: null },
    { id: 3, amount: 'oops' },
    { id: 4, amount: 0 },
  ]
  const r = sumField(rows, 'amount')
  assert.equal(r.total, 100)
  assert.equal(r.validCount, 2)        // 100 and a real 0
  assert.deepEqual(r.invalidIds, [2, 3])
  assert.equal(r.complete, false)
})

test('an unavailable total renders "-" and does not masquerade as zero', () => {
  assert.equal(formatAggregate(0, false), '-')
  assert.equal(formatAggregate(1000, false), '-')
  // whereas a real, available zero shows as currency
  assert.equal(formatAggregate(0, true), '₹0')
})

// ── Other formatters ────────────────────────────────────────────────────────

test('formatNumber distinguishes zero from missing', () => {
  assert.equal(formatNumber(0), '0')
  assert.equal(formatNumber(1500), '1,500')
  assert.equal(formatNumber(null), '-')
  assert.equal(formatNumber(NaN), '-')
  assert.equal(formatNumber(2.5, { decimals: 1 }), '2.5')
})

test('formatRating distinguishes an unrated zero-length history from a 0.0 rating', () => {
  assert.equal(formatRating(4.25), '4.3')
  assert.equal(formatRating(0), '0.0')
  assert.equal(formatRating(null), '-')
  assert.equal(formatRating(undefined), '-')
})

test('formatDate renders "-" for missing or unparseable dates', () => {
  assert.equal(formatDate(null), '-')
  assert.equal(formatDate(''), '-')
  assert.equal(formatDate('not a date'), '-')
  assert.notEqual(formatDate('2026-10-24T00:00:00Z'), '-')
})
