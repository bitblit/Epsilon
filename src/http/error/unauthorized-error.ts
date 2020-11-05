import { SimpleHttpError } from './simple-http-error';

export class UnauthorizedError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 401;

  constructor(...messages: string[]) {
    super(UnauthorizedError.HTTP_CODE, ...messages);
  }
}
