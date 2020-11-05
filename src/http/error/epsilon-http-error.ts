import * as util from 'util';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';

export class EpsilonHttpError<T = void> extends Error {
  private static readonly EPSILON_HTTP_ERROR_FLAG_KEY: string = '__epsilonHttpErrorFlag';
  private _httpStatusCode: number = 500;
  private _errors: string[];
  private _detailErrorCode: number;
  private _endUserErrors: string[];
  private _details: T;
  private _requestId: string;
  private _wrappedError: Error;

  constructor(...errors: string[]) {
    super(EpsilonHttpError.combineErrorStringsWithDefault(errors));
    Object.setPrototypeOf(this, EpsilonHttpError.prototype);
    this._errors = errors;
    this[EpsilonHttpError.EPSILON_HTTP_ERROR_FLAG_KEY] = true; // Just used to tell if one has been wrapped
  }

  public static combineErrorStringsWithDefault(errors: string[], defMessage: string = 'Internal Server Error'): string {
    return errors && errors.length > 0 ? errors.join(',') : defMessage;
  }

  public setFormattedErrorMessage(format: string, ...input: any[]): void {
    const msg: string = util.format(format, ...input);
    this.errors = [msg];
  }

  public withFormattedErrorMessage(format: string, ...input: any[]): EpsilonHttpError<T> {
    this.setFormattedErrorMessage(format, ...input);
    return this;
  }

  public withHttpStatusCode(httpStatusCode: number): EpsilonHttpError<T> {
    this.httpStatusCode = httpStatusCode; // Call setter
    return this;
  }

  public withErrors(errors: string[]): EpsilonHttpError<T> {
    this.errors = errors; // Call setter
    return this;
  }

  public withDetailErrorCode(detailErrorCode: number): EpsilonHttpError<T> {
    this._detailErrorCode = detailErrorCode; // Call setter
    return this;
  }

  public withEndUserErrors(endUserErrors: string[]): EpsilonHttpError<T> {
    this._endUserErrors = endUserErrors; // Call setter
    return this;
  }

  public withDetails(details: T): EpsilonHttpError<T> {
    this._details = details; // Call setter
    return this;
  }

  public withRequestId(requestId: string): EpsilonHttpError<T> {
    this._requestId = requestId; // Call setter
    return this;
  }

  public withWrappedError(err: Error): EpsilonHttpError<T> {
    this._wrappedError = err; // Call setter
    return this;
  }

  public isWrappedError(): boolean {
    return !!this._wrappedError;
  }

  public sanitizeErrorForPublicIfDefaultSet(defaultErrorMessage?: string): EpsilonHttpError<T> {
    let rval: EpsilonHttpError<T> = this;
    if (rval && defaultErrorMessage) {
      rval = Object.assign({}, rval);
      Object.setPrototypeOf(rval, EpsilonHttpError.prototype);
      rval.errors = [defaultErrorMessage];
      rval.wrappedError = null;
    }
    return rval;
  }

  public static wrapError<T = void>(err: Error): EpsilonHttpError<T> {
    let rval: EpsilonHttpError<T> = null;
    if (EpsilonHttpError.objectIsEpsilonHttpError(err)) {
      rval = err as EpsilonHttpError<T>;
    } else {
      rval = new EpsilonHttpError<T>(err.message).withWrappedError(err).withHttpStatusCode(500);
    }
    return rval;
  }

  public static objectIsEpsilonHttpError(obj: any): boolean {
    return obj && obj['__epsilonHttpErrorFlag'] === true;
  }

  get httpStatusCode(): number {
    return this._httpStatusCode;
  }

  get errors(): string[] {
    return this._errors;
  }

  get detailErrorCode(): number {
    return this._detailErrorCode;
  }

  get endUserErrors(): string[] {
    return this._endUserErrors;
  }

  get details(): T {
    return this._details;
  }

  get requestId(): string {
    return this._requestId;
  }

  get wrappedError(): Error {
    return this._wrappedError;
  }

  set httpStatusCode(value: number) {
    this._httpStatusCode = value || 500;
  }

  set errors(value: string[]) {
    this._errors = value || ['Internal Server Error'];
    this.message = EpsilonHttpError.combineErrorStringsWithDefault(this._errors);
  }

  set detailErrorCode(value: number) {
    this._detailErrorCode = value;
  }

  set endUserErrors(value: string[]) {
    this._endUserErrors = value;
  }

  set details(value: T) {
    this._details = value;
  }

  set requestId(value: string) {
    this._requestId = value || 'MISSING';
  }

  set wrappedError(value: Error) {
    this._wrappedError = value;
  }

  public static errorIsX0x(errIn: Error, xClass: number): boolean {
    let rval: boolean = false;
    if (errIn && EpsilonHttpError.objectIsEpsilonHttpError(errIn)) {
      const err: EpsilonHttpError = errIn as EpsilonHttpError;

      const val: number = NumberRatchet.safeNumber(err.httpStatusCode);
      const bot: number = xClass * 100;
      const top: number = bot + 99;
      rval = val >= bot && val <= top;
    }
    return rval;
  }

  public static errorIs40x(err: Error): boolean {
    return EpsilonHttpError.errorIsX0x(err, 4);
  }

  public static errorIs50x(err: Error): boolean {
    return EpsilonHttpError.errorIsX0x(err, 5);
  }
}
