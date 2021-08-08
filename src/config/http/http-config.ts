import { HandlerFunction } from './handler-function';
import { AuthorizerFunction } from './authorizer-function';
import { ErrorProcessorFunction } from '../../http/route/error-processor-function';
import { WebTokenManipulator } from '../../http/auth/web-token-manipulator';
import { HttpMetaProcessingConfig } from './http-meta-processing-config';
import { ApolloGraphqlConfig } from './apollo-graphql-config';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { MappedHttpMetaProcessingConfig } from './mapped-http-meta-processing-config';

export interface HttpConfig {
  // This is used for meta handling for any route not overridden by overrideMetaHandling
  defaultMetaHandling: HttpMetaProcessingConfig;
  // Allows setting meta handling for any specific routes
  // These are evaluated IN ORDER, to allow progressively less specific configuration
  overrideMetaHandling?: MappedHttpMetaProcessingConfig[];
  // If disabled, last resort timeout will instead roll to lambda (not recommended)
  disableLastResortTimeout?: boolean;
  // Maps routes to handlers
  handlers: Map<string, HandlerFunction<any>>;
  // Maps names to authorization functions
  authorizers?: Map<string, AuthorizerFunction>;
  // If set, the processor is called before returning a 50x response
  errorProcessor?: ErrorProcessorFunction;
  // If set, this handler will be used for all OPTIONS (CORS) requests
  customOptionsRequestHandler?: HandlerFunction<any>;
  // If set, paths matching the key will be dereferenced to paths on the server matching the value - use with care
  // TODO: Implement
  staticContentRoutes?: Record<string, string>;
  // If you set a web token manipulator, epsilon will auto-parse the Authorization header
  webTokenManipulator?: WebTokenManipulator;
  // Should typically be your stage name, but can be different in weird cases like custom name map
  // These will be matched case insensitive
  prefixesToStripBeforeRouteMatch?: string[];
  // If set, the AWS request ID will be returned in this header for easier debugging
  requestIdResponseHeaderName?: string;
  // If set, Apollo GraphQL will be used to process matching requests
  apolloConfig?: ApolloGraphqlConfig;
  // If set, the system will use this model validator instead of the OpenAPI one (Uncommon)
  overrideModelValidator?: ModelValidator;
}
