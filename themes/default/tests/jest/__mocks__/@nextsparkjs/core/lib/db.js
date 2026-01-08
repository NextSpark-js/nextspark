/**
 * Mock for @nextsparkjs/core/lib/db
 */

const queryWithRLS = jest.fn().mockResolvedValue([])
const mutateWithRLS = jest.fn().mockResolvedValue({ rowCount: 1 })

module.exports = {
  queryWithRLS,
  mutateWithRLS,
}
