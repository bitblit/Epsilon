import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class BadRequestError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 400;

  constructor(...errors: string[]) {
    super(...errors);
    Object.setPrototypeOf(this, BadRequestError.prototype);
    this.withHttpStatusCode(BadRequestError.HTTP_CODE);
  }
}
