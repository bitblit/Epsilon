export interface EpsilonAuthorizationContext<T> {
  raw: string;
  auth: T;
  error: string;
}
