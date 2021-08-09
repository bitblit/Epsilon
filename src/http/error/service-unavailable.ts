import { EpsilonHttpError } from './epsilon-http-error';

export class ServiceUnavailable<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 503;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(ServiceUnavailable.HTTP_CODE);
  }
}
