import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class ConflictError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 409;

  constructor(...errors: string[]) {
    super(...errors);
    Object.setPrototypeOf(this, ConflictError.prototype);
    this.withHttpStatusCode(ConflictError.HTTP_CODE);
  }
}
