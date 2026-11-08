import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_AMOUNT_CENTS, calculateCommission } from '../lib/commission'

const commission = (amount: number, config: Parameters<typeof calculateCommission>[1]) => calculateCommission(amount, config).commissionCents

test('the percentage part rounds half up to a whole cent', () => {
  assert.equal(commission(14, { percentBps: 1000 }), 1) // 1.4
  assert.equal(commission(15, { percentBps: 1000 }), 2) // 1.5
  assert.equal(commission(16, { percentBps: 1000 }), 2) // 1.6
  assert.equal(commission(5, { percentBps: 1000 }), 1) // 0.5
  assert.equal(commission(4, { percentBps: 1000 }), 0) // 0.4
  assert.equal(commission(10050, { percentBps: 150 }), 151) // 150.75
})

test('no binary fraction moves a result: exact halves that a float rate lands on the wrong side of', () => {
  assert.equal(commission(100500, { percentBps: 1 }), 10) // 10.05
  assert.equal(commission(115, { percentBps: 5000 }), 58) // 57.5
  assert.equal(commission(1105, { percentBps: 100 }), 11) // 11.05
  assert.equal(commission(450, { percentBps: 1100 }), 50) // 49.5
})

test('fixed, minimum, maximum and the cap at the amount apply in that order', () => {
  assert.equal(commission(10000, { percentBps: 1000, fixedCents: 30 }), 1030)
  assert.equal(commission(100, { percentBps: 1000, minCents: 50 }), 50)
  assert.equal(commission(100000, { percentBps: 1000, maxCents: 500 }), 500)
  assert.equal(commission(100000, { percentBps: 1000, fixedCents: 30, maxCents: 500 }), 500)
  assert.equal(commission(40, { percentBps: 0, fixedCents: 100 }), 40)
  assert.equal(commission(40, { percentBps: 0, minCents: 100 }), 40)
})

test('the seller and the platform always add up to the amount', () => {
  for (const amount of [1, 2, 99, 101, 999, 1234567, MAX_AMOUNT_CENTS]) {
    for (const percentBps of [0, 1, 333, 2500, 9999, 10000]) {
      const { commissionCents, sellerCents } = calculateCommission(amount, { percentBps, fixedCents: 7 })
      assert.equal(commissionCents + sellerCents, amount)
      assert.ok(sellerCents >= 0)
    }
  }
})

test('the largest amount is exact', () => {
  assert.equal(commission(MAX_AMOUNT_CENTS, { percentBps: 10000 }), MAX_AMOUNT_CENTS)
  assert.equal(commission(MAX_AMOUNT_CENTS, { percentBps: 1 }), 10_000_000)
})

test('an amount or a config that is not a valid integer is refused', () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity, MAX_AMOUNT_CENTS + 1]) {
    assert.throws(() => commission(amount, { percentBps: 100 }), RangeError, String(amount))
  }
  for (const config of [{ percentBps: 10001 }, { percentBps: -1 }, { percentBps: 1.5 }, { percentBps: 1, fixedCents: -1 }, { percentBps: 1, minCents: 10, maxCents: 5 }]) {
    assert.throws(() => commission(100, config), RangeError, JSON.stringify(config))
  }
})
