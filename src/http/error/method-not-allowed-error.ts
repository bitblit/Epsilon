import { SimpleHttpError } from './simple-http-error';

export class MethodNotAllowedError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 405;

  constructor(...messages: string[]) {
    super(MethodNotAllowedError.HTTP_CODE, ...messages);
  }
}
