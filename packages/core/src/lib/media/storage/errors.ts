/** The pending object changed between the confirm's checks and the copy (S3 answered 412 to the copy's if-match). */
export class PendingObjectChangedError extends Error {
  constructor() {
    super('The pending object changed after it was checked')
  }
}
