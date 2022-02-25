export enum BackgroundHandlerExecutionEventType {
  ProcessStarting = 'ProcessStarting',
  DataValidationError = 'DataValidationError',
  ExecutionSuccessfullyComplete = 'ExecutionSuccessfullyComplete',
  ExecutionFailedError = 'ExecutionRuntimeError',
  NoMatchProcessorName = 'NoMatchProcessorName',
}
