import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class GatewayTimeout<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 504;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(GatewayTimeout.HTTP_CODE);
  }
}
