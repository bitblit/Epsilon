/**
 * This is an example of how to setup a local server for testing.  Replace the createRouterConfig function
 * with your own.
 */
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { ApolloServer, gql } from 'apollo-server-lambda';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';
import fs from 'fs';
import path from 'path';
import { CommonJwtToken, MapRatchet, PromiseRatchet } from '@bitblit/ratchet/dist/common';
import AWS from 'aws-sdk';
import { EpsilonGlobalHandler } from '../epsilon-global-handler';
import { AuthorizerFunction } from '../config/http/authorizer-function';
import { SimpleLoggedInAuth } from '../http/auth/simple-logged-in-auth';
import { HandlerFunction } from '../config/http/handler-function';
import { SimpleRoleRouteAuth } from '../http/auth/simple-role-route-auth';
import { BuiltInHandlers } from '../built-in/http/built-in-handlers';
import { HttpConfig } from '../config/http/http-config';
import { EpsilonConstants } from '../epsilon-constants';
import { LocalWebTokenManipulator } from '../http/auth/local-web-token-manipulator';
import { BackgroundConfig } from '../config/background/background-config';
import { EchoProcessor } from '../built-in/background/echo-processor';
import { NoOpProcessor } from '../built-in/background/no-op-processor';
import { SampleDelayProcessor } from '../built-in/background/sample-delay-processor';
import { LogAndEnqueueEchoProcessor } from '../built-in/background/log-and-enqueue-echo-processor';
import { EpsilonConfig } from '../config/epsilon-config';
import { EpsilonInstance } from '../config/epsilon-instance';
import { EpsilonConfigParser } from '../util/epsilon-config-parser';
import { EpsilonRouter } from '../http/route/epsilon-router';
import { RouterUtil } from '../http/route/router-util';
import { SampleInputValidatedProcessor } from '../built-in/background/sample-input-validated-processor';
import { BackgroundManager } from '../background-manager';

export class SampleServerComponents {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static async createSampleApollo(): Promise<ApolloServer> {
    const gqlString: string = SampleServerComponents.loadSampleServerGQL();
    Logger.silly('Creating apollo from : %s', gqlString);
    const typeDefs = gql(gqlString);

    // Provide resolver functions for your schema fields
    const resolvers = {
      RootQueryType: {
        serverMeta: async (root) => {
          return { version: 'A1', serverTime: new Date().toISOString() };
        },
        forceTimeout: async (root) => {
          // This will be longer than the max timeout
          await PromiseRatchet.wait(1000 * 60 * 30);
          return { placeholder: 'A1' };
        },
      },
    };

    const server: ApolloServer = new ApolloServer({
      debug: false,
      typeDefs,
      resolvers,
      context: async ({ event, context }) => {
        const authTokenSt: string =
          !!event && !!event.headers ? MapRatchet.extractValueFromMapIgnoreCase(event.headers, 'authorization') : null;
        const token: CommonJwtToken<any> = null;
        if (!!authTokenSt && authTokenSt.startsWith('Bearer')) {
          Logger.info('Got : %s', authTokenSt);
        }

        const rval: any = {
          user: token,
          headers: event.headers,
          functionName: context.functionName,
          event,
          context,
        };
        return rval;
      },
    });
    return server;
  }

  // Functions below here are for using as samples

  public static async createSampleEpsilonGlobalHandler(): Promise<EpsilonGlobalHandler> {
    const yamlString: string = SampleServerComponents.loadSampleOpenApiYaml();
    const authorizers: Map<string, AuthorizerFunction> = new Map<string, AuthorizerFunction>();
    const validTokenAuth: SimpleLoggedInAuth = new SimpleLoggedInAuth();
    authorizers.set('BACKGROUND', (token, event, route) => validTokenAuth.handler(token, event, route));

    const handlers: Map<string, HandlerFunction<any>> = new Map<string, HandlerFunction<any>>();
    const simpleRouteAuth: SimpleRoleRouteAuth = new SimpleRoleRouteAuth(['USER'], []);
    authorizers.set('SampleAuthorizer', (token, event, route) => simpleRouteAuth.handler(token, event, route));
    handlers.set('get /', (event, context) => BuiltInHandlers.sample(event, null, context));
    handlers.set('get /meta/server', (event) => BuiltInHandlers.sample(event));
    handlers.set('get /meta/user', (event) => BuiltInHandlers.sample(event));
    handlers.set('get /meta/item/{itemId}', (event) => BuiltInHandlers.sample(event));
    handlers.set('post /secure/access-token', (event) => BuiltInHandlers.sample(event));

    handlers.set('get /multi/fixed', (event) => BuiltInHandlers.sample(event, 'fixed'));
    handlers.set('get /multi/{v}', (event) => BuiltInHandlers.sample(event, 'variable'));
    handlers.set('get /err/{code}', (event) => {
      const err: Error = ErrorRatchet.fErr('Fake Err : %j', event);
      err['statusCode'] = NumberRatchet.safeNumber(event.pathParameters['code']);
      throw err;
    });
    handlers.set('get /meta/simple-item', (event) => {
      const numberToUse: number = NumberRatchet.safeNumber(event.queryStringParameters['num']) || 5;
      const rval: any = {
        numberField: numberToUse,
        stringField: 'Test-String',
      };
      return rval;
    });

    // Unused - intercepted by Epsilon, but needed to prevent 404
    handlers.set('get /graphql', (evt) => BuiltInHandlers.handleNotImplemented(evt));
    handlers.set('post /graphql', (evt) => BuiltInHandlers.handleNotImplemented(evt));

    const cfg: HttpConfig = {
      handlers: handlers,
      authorizers: authorizers,
      corsAllowedHeaders: EpsilonConstants.CORS_MATCH_REQUEST_FLAG,
      corsAllowedOrigins: EpsilonConstants.CORS_MATCH_REQUEST_FLAG,
      corsAllowedMethods: EpsilonConstants.CORS_MATCH_REQUEST_FLAG,
      requestIdResponseHeaderName: 'X-REQUEST-ID',
      defaultErrorMessage: 'Internal Server Error',
      defaultTimeoutMS: 10_000,

      webTokenManipulator: new LocalWebTokenManipulator('abcd1234', 'Epsilon-Sample-Server', 'info'),

      apolloServer: await SampleServerComponents.createSampleApollo(),
      apolloCreateHandlerOptions: {
        cors: {
          origin: '*',
          credentials: true,
        },
      },
      apolloRegex: new RegExp('.*graphql.*'),
      prefixesToStripBeforeRouteMatch: ['v0'],
    };

    const background: BackgroundConfig = {
      aws: {
        queueUrl: 'FAKE-LOCAL',
        notificationArn: 'FAKE-LOCAL',
        sqs: {} as AWS.SQS,
        sns: {} as AWS.SNS,
      },
      // backgroundHttpEndpointAuthorizorName 'BACKGROUND',
      backgroundHttpEndpointPrefix: '/background/',
      processors: [
        new EchoProcessor(),
        new NoOpProcessor(),
        new SampleDelayProcessor(),
        new SampleInputValidatedProcessor(),
        new LogAndEnqueueEchoProcessor(),
      ],
    };

    const epsilonConfig: EpsilonConfig = {
      openApiYamlString: yamlString,
      httpConfig: cfg,
      backgroundConfig: background,
    };

    const backgroundManager: BackgroundManager = new BackgroundManager(epsilonConfig.backgroundConfig.aws);
    backgroundManager.localMode = true;
    const epsilonInstance: EpsilonInstance = EpsilonConfigParser.epsilonConfigToEpsilonInstance(epsilonConfig, backgroundManager);

    const router: EpsilonRouter = epsilonInstance.webHandler.router;
    // Modify a single route...
    RouterUtil.findRoute(router, 'get', '/meta/server').allowLiteralStringNullAsQueryStringParameter = true;

    const rval: EpsilonGlobalHandler = new EpsilonGlobalHandler(epsilonInstance);
    return rval;
  }

  public static loadSampleOpenApiYaml(): string {
    const yamlString: string = fs.readFileSync(path.join(__dirname, '..', 'static', 'sample-open-api-doc.yaml')).toString();
    return yamlString;
  }

  public static loadSampleServerGQL(): string {
    const yamlString: string = fs.readFileSync(path.join(__dirname, '..', 'static', 'sample-server.gql')).toString();
    return yamlString;
  }
}
