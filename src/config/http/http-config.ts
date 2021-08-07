import { HandlerFunction } from './handler-function';
import { AuthorizerFunction } from './authorizer-function';
import { ApolloServer, CreateHandlerOptions } from 'apollo-server-lambda';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { ErrorProcessorFunction } from '../../http/route/error-processor-function';
import { WebTokenManipulator } from '../../http/auth/web-token-manipulator';

export interface HttpConfig {
  handlers: Map<string, HandlerFunction<any>>;
  authorizers?: Map<string, AuthorizerFunction>;
  errorProcessor?: ErrorProcessorFunction;
  customCorsHandler?: HandlerFunction<any>;
  customTimeouts?: Map<string, number>;
  staticContentPaths?: string[]; // TODO: Implement
  customExtraHeaders?: Map<string, string>; // TODO: Implement
  // Allows you to define an error message for errors that escape all the way to epsilon,
  // preventing information leakage
  defaultErrorMessage?: string;
  corsAllowedOrigins?: string;
  corsAllowedMethods?: string;
  corsAllowedHeaders?: string;
  // If you set a web token manipulator, epsilon will auto-parse the Authorization header
  webTokenManipulator?: WebTokenManipulator;
  overrideModelValidator?: ModelValidator; // If set, overrides the one auto-created from yaml
  // Should typically be your stage name, but can be different in weird cases like custom name map
  // These will be matched case insensitive
  prefixesToStripBeforeRouteMatch?: string[];
  requestIdResponseHeaderName?: string;

  disableAutoCORSOptionHandler?: boolean;
  defaultTimeoutMS?: number;
  // See EventUtil.fixStillEncodedQueryParams for an explanation here
  disableAutoFixStillEncodedQueryParams?: boolean;
  disableAutoAddCorsHeadersToResponses?: boolean;
  disableCompression?: boolean;
  // If set, paths matching this are sent to Apollo for Graphql instead
  apolloRegex?: RegExp;
  apolloServer?: ApolloServer;
  apolloCreateHandlerOptions?: CreateHandlerOptions;
}
