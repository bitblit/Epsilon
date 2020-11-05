import { SimpleHttpError } from './simple-http-error';

export class ForbiddenError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 403;

  constructor(...messages: string[]) {
    super(ForbiddenError.HTTP_CODE, ...messages);
  }
}
