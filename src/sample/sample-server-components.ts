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
import { HandlerFunction } from '../config/http/handler-function';
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
import { EpsilonInstance } from '../epsilon-instance';
import { EpsilonConfigParser } from '../util/epsilon-config-parser';
import { EpsilonRouter } from '../http/route/epsilon-router';
import { RouterUtil } from '../http/route/router-util';
import { SampleInputValidatedProcessor } from '../built-in/background/sample-input-validated-processor';
import { BackgroundManager } from '../background-manager';
import { HttpMetaProcessingConfig } from '../config/http/http-meta-processing-config';
import { BuiltInAuthorizers } from '../built-in/http/built-in-authorizers';
import { ApolloFilter } from '../built-in/http/apollo-filter';
import { SampleInputValidatedProcessorData } from '../built-in/background/sample-input-validated-processor-data';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { BuiltInFilters } from '../built-in/http/built-in-filters';

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
    authorizers.set('SampleAuthorizer', (token, evt) => BuiltInAuthorizers.simpleLoggedInAuth(token, evt));
    authorizers.set('LogAuthorizer', (token, evt) => BuiltInAuthorizers.simpleNoAuthenticationLogAccess(token, evt));

    const handlers: Map<string, HandlerFunction<any>> = new Map<string, HandlerFunction<any>>();
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
    handlers.set('get /meta/sample-item', async (event) => {
      const numberToUse: number = NumberRatchet.safeNumber(event.queryStringParameters['num']) || 5;
      const rval: SampleInputValidatedProcessorData = {
        numberParam: numberToUse,
        nameParam: 'Test-String',
      };
      return rval;
    });
    handlers.set('post /meta/sample-item', async (event) => {
      const parsed: SampleInputValidatedProcessorData = event.parsedBody;
      const forceFail: boolean = BooleanRatchet.parseBool(StringRatchet.trimToNull(event.queryStringParameters['forceFail'])) === true;
      if (forceFail) {
        parsed['numberParam'] = 'test' as unknown as number; // Should cause a failure outbound
      }

      return parsed;
    });

    // Unused - intercepted by the Apollo filter, but needed to prevent 404
    handlers.set('get /graphql', (evt) => BuiltInHandlers.handleNotImplemented(evt));
    handlers.set('post /graphql', (evt) => BuiltInHandlers.handleNotImplemented(evt));

    const tokenManipulator: LocalWebTokenManipulator = new LocalWebTokenManipulator('abcd1234', 'sample.erigir.com', 'debug');
    const meta: HttpMetaProcessingConfig = RouterUtil.defaultAuthenticationHeaderParsingEpsilonPreFilters(tokenManipulator);
    meta.timeoutMS = 10_000;
    ApolloFilter.addApolloFilterToList(meta.preFilters, new RegExp('.*graphql.*'), await SampleServerComponents.createSampleApollo(), {
      cors: {
        origin: '*',
        credentials: true,
      },
    });
    meta.errorFilters.push((fCtx) => BuiltInFilters.secureOutboundServerErrorForProduction(fCtx, 'Clean Internal Server Error', 500));

    const cfg: HttpConfig = {
      defaultMetaHandling: meta,
      handlers: handlers,
      authorizers: authorizers,
      requestIdResponseHeaderName: 'X-REQUEST-ID',
      overrideMetaHandling: [
        {
          pathRegex: '/background',
          methods: null,
          config: Object.assign({}, meta, { overrideAuthorizerName: 'LogAuthorizer' }),
        },
      ],
      webTokenManipulator: tokenManipulator,
      apolloConfig: {
        apolloServer: await SampleServerComponents.createSampleApollo(),
        createHandlerOptions: {
          cors: {
            origin: '*',
            credentials: true,
          },
        },
        pathRegex: new RegExp('.*graphql.*'),
      },
      prefixesToStripBeforeRouteMatch: ['v0'],
    };

    const background: BackgroundConfig = {
      aws: {
        queueUrl: 'FAKE-LOCAL',
        notificationArn: 'FAKE-LOCAL',
      },
      backgroundHttpEndpointPrefix: '/background',
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

    const backgroundManager: BackgroundManager = new BackgroundManager(epsilonConfig.backgroundConfig.aws, {} as AWS.SQS, {} as AWS.SNS);
    backgroundManager.localMode = true;
    const epsilonInstance: EpsilonInstance = EpsilonConfigParser.epsilonConfigToEpsilonInstance(epsilonConfig, backgroundManager);

    const router: EpsilonRouter = epsilonInstance.webHandler.router;
    // Modify a single route...
    // RouterUtil.findRoute(router, 'get', '/meta/server').metaProcessingConfig.allowLiteralStringNullAsQueryStringParameter = true;

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
