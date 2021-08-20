import { HttpProcessingConfig } from './http-processing-config';

export interface MappedHttpProcessingConfig {
  // If set and nonempty, only verbs in this list will match
  methods?: string[];
  // Must be set, only paths matching this regex will match
  pathRegex: string;
  // If true, paths NOT matching the regex are used instead of paths matching
  invertPathMatching?: boolean;
  // Config to use
  config: HttpProcessingConfig;
}
