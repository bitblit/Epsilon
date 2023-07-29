import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class BadGateway<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 502;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(BadGateway.HTTP_CODE);
  }
}
