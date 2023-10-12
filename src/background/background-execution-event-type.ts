// NOTE: This is a psuedo-enum to fix some issues with Typescript enums.  See: https://exploringjs.com/tackling-ts/ch_enum-alternatives.html for details
export const BackgroundExecutionEventType = {
  ProcessStarting: 'ProcessStarting',
  DataValidationError: 'DataValidationError',
  ExecutionSuccessfullyComplete: 'ExecutionSuccessfullyComplete',
  ExecutionFailedError: 'ExecutionRuntimeError',
  NoMatchProcessorName: 'NoMatchProcessorName',
};
export type BackgroundExecutionEventType = (typeof BackgroundExecutionEventType)[keyof typeof BackgroundExecutionEventType];
