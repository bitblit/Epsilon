import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export interface EpsilonAuthorizationContext<T> {
  raw: string;
  auth: T;
  error: string;
  authFailureException: RestfulApiHttpError;
}
