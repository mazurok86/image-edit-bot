export class ReplicateApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ReplicateApiError'
  }
}
