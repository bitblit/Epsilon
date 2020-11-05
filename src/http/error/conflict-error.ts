import { SimpleHttpError } from './simple-http-error';

export class ConflictError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 409;

  constructor(...messages: string[]) {
    super(ConflictError.HTTP_CODE, ...messages);
  }
}
