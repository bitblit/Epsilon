import { HandlerFunction } from './handler-function';
import { AuthorizerFunction } from './authorizer-function';
import { HttpProcessingConfig } from './http-processing-config';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { MappedHttpProcessingConfig } from './mapped-http-processing-config';

export interface HttpConfig {
  // This is used for meta handling for any route not overridden by overrideMetaHandling
  defaultMetaHandling: HttpProcessingConfig;
  // Allows setting meta handling for any specific routes
  // These are evaluated IN ORDER, to allow progressively less specific configuration
  overrideMetaHandling?: MappedHttpProcessingConfig[];
  // Maps routes to handlers
  handlers: Map<string, HandlerFunction<any>>;
  // Maps names to authorization functions
  authorizers?: Map<string, AuthorizerFunction>;
  // If set, paths matching the key will be dereferenced to paths on the server matching the value - use with care
  // TODO: Implement
  staticContentRoutes?: Record<string, string>;
  // Should typically be your stage name, but can be different in weird cases like custom name map
  // These will be matched case insensitive
  prefixesToStripBeforeRouteMatch?: string[];
  // If set, the system will use this model validator instead of the OpenAPI one (Uncommon)
  overrideModelValidator?: ModelValidator;
  // These paths are expected to be handled by a filter, and therefore should not cause a parse failure
  filterHandledRouteMatches?: string[];
}
