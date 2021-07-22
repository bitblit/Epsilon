import util from 'util';

export class EpsilonBackgroundProcessError<T = void> extends Error {
  private static readonly EPSILON_BACKGROUND_PROCESS_ERROR_FLAG_KEY: string = '__epsilonBackgroundProcessErrorFlag';
  private _errors: string[];
  private _detailErrorCode: number;
  private _details: T;
  private _requestId: string;
  private _wrappedError: Error;

  constructor(...errors: string[]) {
    super(EpsilonBackgroundProcessError.combineErrorStringsWithDefault(errors));
    Object.setPrototypeOf(this, EpsilonBackgroundProcessError.prototype);
    this._errors = errors;
    this[EpsilonBackgroundProcessError.EPSILON_BACKGROUND_PROCESS_ERROR_FLAG_KEY] = true; // Just used to tell if one has been wrapped
  }

  public static combineErrorStringsWithDefault(errors: string[], defMessage: string = 'Internal Server Error'): string {
    return errors && errors.length > 0 ? errors.join(',') : defMessage;
  }

  public setFormattedErrorMessage(format: string, ...input: any[]): void {
    const msg: string = util.format(format, ...input);
    this.errors = [msg];
  }

  public withFormattedErrorMessage(format: string, ...input: any[]): EpsilonBackgroundProcessError<T> {
    this.setFormattedErrorMessage(format, ...input);
    return this;
  }

  public withErrors(errors: string[]): EpsilonBackgroundProcessError<T> {
    this.errors = errors; // Call setter
    return this;
  }

  public withDetailErrorCode(detailErrorCode: number): EpsilonBackgroundProcessError<T> {
    this._detailErrorCode = detailErrorCode; // Call setter
    return this;
  }

  public withDetails(details: T): EpsilonBackgroundProcessError<T> {
    this._details = details; // Call setter
    return this;
  }

  public withRequestId(requestId: string): EpsilonBackgroundProcessError<T> {
    this._requestId = requestId; // Call setter
    return this;
  }

  public withWrappedError(err: Error): EpsilonBackgroundProcessError<T> {
    this._wrappedError = err; // Call setter
    return this;
  }

  public isWrappedError(): boolean {
    return !!this._wrappedError;
  }

  public static wrapError<T = void>(err: Error): EpsilonBackgroundProcessError<T> {
    let rval: EpsilonBackgroundProcessError<T> = null;
    if (EpsilonBackgroundProcessError.objectIsEpsilonBackgroundProcessError(err)) {
      rval = err as EpsilonBackgroundProcessError<T>;
    } else {
      rval = new EpsilonBackgroundProcessError<T>(err.message).withWrappedError(err);
    }
    return rval;
  }

  public static objectIsEpsilonBackgroundProcessError(obj: any): boolean {
    return obj && obj['__epsilonHttpErrorFlag'] === true;
  }

  set errors(value: string[]) {
    this._errors = value || ['Internal Server Error'];
    this.message = EpsilonBackgroundProcessError.combineErrorStringsWithDefault(this._errors);
  }
  get errors(): string[] {
    return this._errors;
  }

  set detailErrorCode(value: number) {
    this._detailErrorCode = value;
  }
  get detailErrorCode(): number {
    return this._detailErrorCode;
  }

  set details(value: T) {
    this._details = value;
  }
  get details(): T {
    return this._details;
  }

  set requestId(value: string) {
    this._requestId = value || 'MISSING';
  }
  get requestId(): string {
    return this._requestId;
  }

  set wrappedError(value: Error) {
    this._wrappedError = value;
  }
  get wrappedError(): Error {
    return this._wrappedError;
  }
}
