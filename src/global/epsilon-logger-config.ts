export interface EpsilonLoggerConfig {
  // If set, the logger will be set to this instead of the default
  envParamLogLevelName: string;
  // If set, and the user provides the query param, the logger level will be set to this
  queryParamLogLevelName: string;

  // If set, and the user provides the query param, the logger will use this common prefix for the transaction
  queryParamTracePrefixName: string;
}
