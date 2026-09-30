/**
 * Customer Entity Types
 *
 * Not written here: the API shape of an entity is generated from the project's entity config into
 * the portable contracts package (`nextspark prepare`), so the app cannot drift from the server.
 */

export type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  // Day options for visit/contact days
  CustomerVisitDaysOption as DayOption,
} from '@project/contracts'
