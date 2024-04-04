import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class RequestTimeoutError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 500;

  constructor(...errors: string[]) {
    super(...errors);
    Object.setPrototypeOf(this, RequestTimeoutError.prototype);
    this.withHttpStatusCode(RequestTimeoutError.HTTP_CODE);
  }
}
