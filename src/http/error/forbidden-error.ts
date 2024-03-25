import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class ForbiddenError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 403;

  constructor(...errors: string[]) {
    super(...errors);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
    this.withHttpStatusCode(ForbiddenError.HTTP_CODE);
  }
}
