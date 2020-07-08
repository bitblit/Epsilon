export interface RouteValidatorConfig {
  modelName: string; // Must be a valid entry in the model validator
  emptyAllowed: boolean; // If true, an empty body passes validation, otherwise fails
  extraPropertiesAllowed: boolean; // If true, extra properties in the body don't cause failure
}
