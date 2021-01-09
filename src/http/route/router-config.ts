import { RouteMapping } from './route-mapping';
import { ModelValidator } from './model-validator';
import { AuthorizerFunction } from './authorizer-function';
import { WebTokenManipulator } from '../auth/web-token-manipulator';
import { ErrorProcessorFunction } from './error-processor-function';
import { ApolloServer, CreateHandlerOptions } from 'apollo-server-lambda';

export interface RouterConfig {
  routes: RouteMapping[];

  authorizers: Map<string, AuthorizerFunction>;

  // See EventUtil.fixStillEncodedQueryParams for an explanation here
  autoFixStillEncodedQueryParams: boolean;

  // Future expansion
  disableCORS: boolean;
  disableCompression: boolean;
  staticContentPaths: string[];

  // Allows you to define an error message for errors that escape all the way to epsilon,
  // preventing information leakage
  defaultErrorMessage: string;

  defaultTimeoutMS: number;

  errorProcessor: ErrorProcessorFunction;

  corsAllowedOrigins: string;
  corsAllowedMethods: string;
  corsAllowedHeaders: string;

  // If you set a web token manipulator, epsilon will auto-parse the Authorization header
  webTokenManipulator: WebTokenManipulator;

  modelValidator: ModelValidator; // Must be set to use model validation in your route mappings

  // Should typically be your stage name, but can be different in weird cases like custom name map
  // These will be matched case insensitive
  prefixesToStripBeforeRouteMatch: string[];

  requestIdResponseHeaderName: string;
  convertNullReturnedObjectsTo404: boolean;
  allowLiteralStringNullAsPathParameter: boolean;
  allowLiteralStringNullAsQueryStringParameter: boolean;
  validateOutboundResponseBody: boolean;

  // If set, paths matching this are sent to Apollo for Graphql instead
  apolloRegex?: RegExp;
  apolloServer?: ApolloServer;
  apolloCreateHandlerOptions?: CreateHandlerOptions;
}
