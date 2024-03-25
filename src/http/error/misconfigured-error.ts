import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class MisconfiguredError<T = void> extends RestfulApiHttpError<T> {
  public static readonly HTTP_CODE: number = 500;

  constructor(...errors: string[]) {
    super(...errors);
    Object.setPrototypeOf(this, MisconfiguredError.prototype);
    this.withHttpStatusCode(MisconfiguredError.HTTP_CODE);
  }
}
