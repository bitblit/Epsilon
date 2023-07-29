import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class ServiceUnavailable<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 503;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(ServiceUnavailable.HTTP_CODE);
  }
}
