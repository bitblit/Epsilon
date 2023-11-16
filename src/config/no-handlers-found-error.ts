export class NoHandlersFoundError extends Error {
  constructor(msg?: string) {
    super(msg ?? 'No handlers found');
    Object.setPrototypeOf(this, NoHandlersFoundError.prototype);
  }
}
