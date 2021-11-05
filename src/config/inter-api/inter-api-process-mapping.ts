/**
 * When an event matching the source and type is received, the listed background types will be
 * enqueued with the data from the inter-api block being treated as the data block of the background
 * task
 */
export interface InterApiProcessMapping {
  sourceRegex: string;
  typeRegex: string;
  disabled: boolean;
  backgroundProcessTypes: string[];
}
