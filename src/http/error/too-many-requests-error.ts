import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class TooManyRequestsError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 429;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(TooManyRequestsError.HTTP_CODE);
  }
}
