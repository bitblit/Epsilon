export interface GenericAwsEventHandlerFunction<T> {
  (event: T): Promise<any>;
}
