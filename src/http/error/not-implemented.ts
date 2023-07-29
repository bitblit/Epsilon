import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class NotImplemented<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 501;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(NotImplemented.HTTP_CODE);
  }
}
