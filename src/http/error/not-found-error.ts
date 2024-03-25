import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class NotFoundError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 404;

  constructor(...errors: string[]) {
    super(...errors);
    Object.setPrototypeOf(this, NotFoundError.prototype);
    this.withHttpStatusCode(NotFoundError.HTTP_CODE);
  }
}
