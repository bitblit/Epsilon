import { SimpleHttpError } from './simple-http-error';

export class MisconfiguredError extends SimpleHttpError {
  public static readonly HTTP_CODE: number = 500;

  constructor(...messages: string[]) {
    super(MisconfiguredError.HTTP_CODE, ...messages);
  }
}
