/**
 * Search terms in LIKE/ILIKE patterns. `%` and `_` are wildcards and `\` is the escape character, so a term typed by
 * a person (`50%`, `first_name`) must be escaped before it is wrapped in `%…%`, and the comparison must say
 * `ESCAPE '\'`. One place does both so no search branch forgets one half.
 */

/** Longest search term the entities API accepts (characters, after trimming). */
export const MAX_SEARCH_TERM_LENGTH = 200

/** Written right after the bound pattern: `col ILIKE $1 ESCAPE '\'`. */
export const LIKE_ESCAPE_CLAUSE = "ESCAPE '\\'"

/** The term with `\`, `%` and `_` escaped, so each matches itself. */
export const escapeLikeTerm = (term: string): string => term.replace(/[\\%_]/g, '\\$&')

/** The pattern for "contains the term, literally". */
export const containsPattern = (term: string): string => `%${escapeLikeTerm(term)}%`
