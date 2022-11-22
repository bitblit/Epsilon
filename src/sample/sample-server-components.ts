/**
 * This is an example of how to setup a local server for testing.  Replace the createRouterConfig function
 * with your own.
 */
import { Logger } from '@bitblit/ratchet/common/logger';
import { ApolloServer, CreateHandlerOptions, gql } from 'apollo-server-lambda';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import { ErrorRatchet } from '@bitblit/ratchet/common/error-ratchet';
import { NumberRatchet } from '@bitblit/ratchet/common/number-ratchet';
import fs from 'fs';
import path from 'path';
import { JwtTokenBase, LoggerLevelName, PromiseRatchet } from '@bitblit/ratchet/common';
import AWS from 'aws-sdk';
import { EpsilonGlobalHandler } from '../epsilon-global-handler';
import { AuthorizerFunction } from '../config/http/authorizer-function';
import { HandlerFunction } from '../config/http/handler-function';
import { BuiltInHandlers } from '../built-in/http/built-in-handlers';
import { HttpConfig } from '../config/http/http-config';
import { LocalWebTokenManipulator } from '../http/auth/local-web-token-manipulator';
import { BackgroundConfig } from '../config/background/background-config';
import { EchoProcessor } from '../built-in/background/echo-processor';
import { NoOpProcessor } from '../built-in/background/no-op-processor';
import { SampleDelayProcessor } from '../built-in/background/sample-delay-processor';
import { LogAndEnqueueEchoProcessor } from '../built-in/background/log-and-enqueue-echo-processor';
import { EpsilonConfig } from '../config/epsilon-config';
import { EpsilonInstance } from '../epsilon-instance';
import { EpsilonConfigParser } from '../util/epsilon-config-parser';
import { RouterUtil } from '../http/route/router-util';
import { SampleInputValidatedProcessor } from '../built-in/background/sample-input-validated-processor';
import { BackgroundManager } from '../background-manager';
import { HttpProcessingConfig } from '../config/http/http-processing-config';
import { BuiltInAuthorizers } from '../built-in/http/built-in-authorizers';
import { ApolloFilter } from '../built-in/http/apollo-filter';
import { SampleInputValidatedProcessorData } from '../built-in/background/sample-input-validated-processor-data';
import { BooleanRatchet } from '@bitblit/ratchet/common/boolean-ratchet';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { BuiltInFilters } from '../built-in/http/built-in-filters';
import { EventUtil } from '../http/event-util';
import { LogMessageBackgroundErrorProcessor } from '../built-in/background/log-message-background-error-processor';

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
      introspection: true,
      typeDefs,
      resolvers,
      plugins: [ApolloServerPluginLandingPageGraphQLPlayground({ endpoint: '/graphql' })],
      context: async ({ event, context, express }) => {
        const authTokenSt: string = EventUtil.extractBearerTokenFromEvent(event);
        const token: JwtTokenBase = null;
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
  public static async createSampleEpsilonConfig(): Promise<EpsilonConfig> {
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
    // GraphQL endpoints are handled by filter and aren't in the OpenAPI spec so no need to wire them here

    const tokenManipulator: LocalWebTokenManipulator<JwtTokenBase> = new LocalWebTokenManipulator(['abcd1234'], 'sample.erigir.com')
      .withParseFailureLogLevel(LoggerLevelName.debug)
      .withExtraDecryptionKeys(['abcdefabcdef'])
      .withOldKeyUseLogLevel(LoggerLevelName.info);

    const meta: HttpProcessingConfig = RouterUtil.defaultHttpMetaProcessingConfigWithAuthenticationHeaderParsing(tokenManipulator);
    meta.timeoutMS = 10_000;

    ApolloFilter.addApolloFilterToList(meta.preFilters, new RegExp('.*graphql.*'), await SampleServerComponents.createSampleApollo(), {
      cors: {
        origin: '*',
        credentials: true,
      },
    } as CreateHandlerOptions);
    meta.errorFilters.push((fCtx) => BuiltInFilters.secureOutboundServerErrorForProduction(fCtx, 'Clean Internal Server Error', 500));

    const preFiltersAllowingNull: HttpProcessingConfig = Object.assign({}, meta);
    // TODO: This approach is pretty fragile...
    preFiltersAllowingNull.preFilters = Object.assign([], preFiltersAllowingNull.preFilters);
    preFiltersAllowingNull.preFilters.splice(8, 1);

    const cfg: HttpConfig = {
      defaultMetaHandling: meta,
      handlers: handlers,
      authorizers: authorizers,
      overrideMetaHandling: [
        {
          pathRegex: '/background',
          methods: null,
          config: Object.assign({}, meta, { overrideAuthorizerName: 'LogAuthorizer' }),
        },
        {
          pathRegex: '/meta/server', // Allow null params ONLY on this route
          methods: ['GET'],
          config: preFiltersAllowingNull,
        },
      ],
      prefixesToStripBeforeRouteMatch: ['v0'],
      filterHandledRouteMatches: ['options .*'],
    };

    const background: BackgroundConfig = {
      aws: {
        queueUrl: 'FAKE-LOCAL',
        notificationArn: 'FAKE-LOCAL',
      },
      httpMetaEndpoint: '/background/meta',
      httpSubmissionPath: '/background',
      implyTypeFromPathSuffix: false,
      processors: [
        new EchoProcessor(),
        new NoOpProcessor(),
        new SampleDelayProcessor(),
        new SampleInputValidatedProcessor(),
        new LogAndEnqueueEchoProcessor(),
      ],
      errorProcessor: new LogMessageBackgroundErrorProcessor(),
    };

    const epsilonConfig: EpsilonConfig = {
      openApiYamlString: yamlString,
      httpConfig: cfg,
      backgroundConfig: background,
    };
    return epsilonConfig;
  }

  public static async createSampleEpsilonGlobalHandler(): Promise<EpsilonGlobalHandler> {
    const epsilonConfig: EpsilonConfig = await SampleServerComponents.createSampleEpsilonConfig();
    const backgroundManager: BackgroundManager = new BackgroundManager(epsilonConfig.backgroundConfig.aws, {} as AWS.SQS, {} as AWS.SNS);
    backgroundManager.localMode = true;
    const epsilonInstance: EpsilonInstance = EpsilonConfigParser.epsilonConfigToEpsilonInstance(epsilonConfig, backgroundManager);
    const rval: EpsilonGlobalHandler = new EpsilonGlobalHandler(epsilonInstance);
    return rval;
  }

  public static async createSampleBatchOnlyEpsilonGlobalHandler(): Promise<EpsilonGlobalHandler> {
    const epsilonConfig: EpsilonConfig = await SampleServerComponents.createSampleEpsilonConfig();
    epsilonConfig.httpConfig.handlers = new Map<string, HandlerFunction<any>>(); // Unused

    const byPassCfg: HttpProcessingConfig = Object.assign({}, epsilonConfig.httpConfig.defaultMetaHandling);
    byPassCfg.preFilters = byPassCfg.preFilters.concat([
      (fCtx) => BuiltInFilters.autoRespond(fCtx, { message: 'Background Processing Only' }),
    ]);
    epsilonConfig.httpConfig.overrideMetaHandling = [
      {
        pathRegex: '.*background.*',
        invertPathMatching: true,
        config: byPassCfg,
      },
    ];
    epsilonConfig.httpConfig.filterHandledRouteMatches = ['.*']; // Only want the batch handling

    const backgroundManager: BackgroundManager = new BackgroundManager(epsilonConfig.backgroundConfig.aws, {} as AWS.SQS, {} as AWS.SNS);
    backgroundManager.localMode = true;
    const epsilonInstance: EpsilonInstance = EpsilonConfigParser.epsilonConfigToEpsilonInstance(epsilonConfig, backgroundManager);
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
