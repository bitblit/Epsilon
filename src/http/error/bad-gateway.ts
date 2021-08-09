import { EpsilonHttpError } from './epsilon-http-error';

export class BadGateway<T = void> extends EpsilonHttpError<T> {
  public static readonly HTTP_CODE: number = 502;

  constructor(...errors: string[]) {
    super(...errors);
    this.withHttpStatusCode(BadGateway.HTTP_CODE);
  }
}
