export enum BackgroundHandlerEventType {
  ProcessStarting = 'ProcessStarting',
  DataValidationError = 'DataValidationError',
  ExecutionSuccessfullyComplete = 'ExecutionSuccessfullyComplete',
  ExecutionFailedError = 'ExecutionRuntimeError',
  NoMatchProcessorName = 'NoMatchProcessorName',
}
