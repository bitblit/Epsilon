import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class UnauthorizedError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 401;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(UnauthorizedError.HTTP_CODE);
  }
}
