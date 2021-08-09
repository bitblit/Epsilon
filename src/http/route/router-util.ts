import { EpsilonRouter } from './epsilon-router';
import { MisconfiguredError } from '../error/misconfigured-error';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { RouteMapping } from './route-mapping';
import { RouteValidatorConfig } from './route-validator-config';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { OpenApiDocument } from '../../config/open-api/open-api-document';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { BackgroundHttpAdapterHandler } from '../../background/background-http-adapter-handler';
import { HandlerFunction } from '../../config/http/handler-function';
import { HttpConfig } from '../../config/http/http-config';
import { AuthorizerFunction } from '../../config/http/authorizer-function';
import { HttpMetaProcessingConfig } from '../../config/http/http-meta-processing-config';
import { NullReturnedObjectHandling } from '../../config/http/null-returned-object-handling';
import { MappedHttpMetaProcessingConfig } from '../../config/http/mapped-http-meta-processing-config';
import { BuiltInFilters } from '../../built-in/http/built-in-filters';
import { WebTokenManipulator } from '../auth/web-token-manipulator';
import { BuiltInHandlers } from '../../built-in/http/built-in-handlers';
import { FilterFunction } from '../../config/http/filter-function';
import { BuiltInAuthFilters } from '../../built-in/http/built-in-auth-filters';
import { LogLevelManipulationFilter } from '../../built-in/http/log-level-manipulation-filter';

/**
 * Endpoints about the api itself
 */
export class RouterUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static defaultAuthenticationHeaderParsingEpsilonPreFilters(webTokenManipulator: WebTokenManipulator): FilterFunction[] {
    return [
      (fCtx) => BuiltInAuthFilters.parseAuthorizationHeader(fCtx, webTokenManipulator),
      (fCtx) => BuiltInAuthFilters.applyOpenApiAuthorization(fCtx),
    ].concat(RouterUtil.defaultEpsilonPreFilters());
  }

  public static defaultEpsilonPreFilters(): FilterFunction[] {
    return [
      (fCtx) => BuiltInFilters.autoRespondToOptionsRequestWithCors(fCtx),
      (fCtx) => BuiltInFilters.ensureEventMaps(fCtx),
      (fCtx) => LogLevelManipulationFilter.setLogLevelForTransaction(fCtx),
      (fCtx) => BuiltInFilters.parseBodyObject(fCtx),
      (fCtx) => BuiltInFilters.fixStillEncodedQueryParams(fCtx),
      (fCtx) => BuiltInFilters.disallowStringNullAsPathParameter(fCtx),
      (fCtx) => BuiltInFilters.disallowStringNullAsQueryStringParameter(fCtx),
      (fCtx) => BuiltInFilters.validateInboundBody(fCtx),
      (fCtx) => BuiltInFilters.validateInboundQueryParams(fCtx),
      (fCtx) => BuiltInFilters.validateInboundQueryParams(fCtx),
    ];
  }

  public static defaultEpsilonPostFilters(): FilterFunction[] {
    return [
      (fCtx) => BuiltInFilters.validateOutboundResponse(fCtx),
      (fCtx) => BuiltInFilters.addAWSRequestIdHeader(fCtx),
      (fCtx) => BuiltInFilters.addAllowReflectionCORSHeaders(fCtx),
      (fCtx) => BuiltInFilters.applyGzipIfPossible(fCtx),
      (fCtx) => BuiltInFilters.checkMaximumLambdaBodySize(fCtx),
      (fCtx) => LogLevelManipulationFilter.clearLogLevelForTransaction(fCtx),
    ];
  }

  public static defaultEpsilonErrorFilters(): FilterFunction[] {
    return [
      (fCtx) => BuiltInFilters.addAWSRequestIdHeader(fCtx),
      (fCtx) => BuiltInFilters.addAllowReflectionCORSHeaders(fCtx),
      (fCtx) => LogLevelManipulationFilter.clearLogLevelForTransaction(fCtx),
    ];
  }

  public static defaultHttpMetaProcessingConfigWithAuthenticationHeaderParsing(
    webTokenManipulator: WebTokenManipulator
  ): HttpMetaProcessingConfig {
    const defaults: HttpMetaProcessingConfig = {
      configName: 'EpsilonDefaultHttpMetaProcessingConfig',
      timeoutMS: 30_000,
      overrideAuthorizerName: null,
      preFilters: RouterUtil.defaultAuthenticationHeaderParsingEpsilonPreFilters(webTokenManipulator),
      postFilters: RouterUtil.defaultEpsilonPostFilters(),
      errorFilters: RouterUtil.defaultEpsilonErrorFilters(),
      nullReturnedObjectHandling: NullReturnedObjectHandling.Return404NotFoundResponse,
    };
    return defaults;
  }

  public static defaultHttpMetaProcessingConfig(): HttpMetaProcessingConfig {
    const defaults: HttpMetaProcessingConfig = {
      configName: 'EpsilonDefaultHttpMetaProcessingConfig',
      timeoutMS: 30_000,
      overrideAuthorizerName: null,
      preFilters: RouterUtil.defaultEpsilonPreFilters(),
      postFilters: RouterUtil.defaultEpsilonPostFilters(),
      errorFilters: RouterUtil.defaultEpsilonErrorFilters(),
      nullReturnedObjectHandling: NullReturnedObjectHandling.Return404NotFoundResponse,
    };
    return defaults;
  }

  public static assignDefaultsOnHttpConfig(cfg: HttpConfig): HttpConfig {
    const defaults: HttpConfig = {
      handlers: new Map<string, HandlerFunction<any>>(),
      authorizers: new Map<string, AuthorizerFunction>(),
      defaultMetaHandling: this.defaultHttpMetaProcessingConfig(),
      staticContentRoutes: {},
      prefixesToStripBeforeRouteMatch: [],
      filterHandledRouteMatches: ['options .*'], // Ignore all Options since they are handled by the default prefilter
    };
    const rval: HttpConfig = Object.assign({}, defaults, cfg || {});
    return rval;
  }

  // Search the overrides in order to find a match, otherwise return default
  public static findApplicableMeta(httpConfig: HttpConfig, method: string, path: string): HttpMetaProcessingConfig {
    let rval: HttpMetaProcessingConfig = null;
    if (httpConfig?.overrideMetaHandling) {
      for (let i = 0; i < httpConfig.overrideMetaHandling.length && !rval; i++) {
        const test: MappedHttpMetaProcessingConfig = httpConfig.overrideMetaHandling[i];
        if (
          !test.methods ||
          test.methods.length === 0 ||
          test.methods.map((s) => s.toLocaleLowerCase()).includes(method.toLocaleLowerCase())
        ) {
          if (test.pathRegex.match(path)) {
            rval = test.config;
          }
        }
      }
    }
    if (!rval) {
      rval = httpConfig.defaultMetaHandling || RouterUtil.defaultHttpMetaProcessingConfig(); // If nothing found, use epsilon defaults
    }

    return rval;
  }

  // Parses an open api file to create a router config
  public static openApiYamlToRouterConfig(
    httpConfig: HttpConfig,
    openApiDoc: OpenApiDocument,
    modelValidator: ModelValidator,
    backgroundHttpAdapterHandler: BackgroundHttpAdapterHandler
  ): EpsilonRouter {
    if (!openApiDoc || !httpConfig) {
      throw new MisconfiguredError('Cannot configure, missing either yaml or cfg');
    }
    const rval: EpsilonRouter = {
      routes: [],
      openApiModelValidator: modelValidator,
      config: RouterUtil.assignDefaultsOnHttpConfig(httpConfig),
    };

    if (openApiDoc?.components?.securitySchemes) {
      // Just validation, nothing to wire here
      Object.keys(openApiDoc.components.securitySchemes).forEach((sk) => {
        if (!rval.config.authorizers || !rval.config.authorizers.get(sk)) {
          throw new MisconfiguredError().withFormattedErrorMessage('Doc requires authorizer %s but not found in map', sk);
        }
      });
    }

    const missingPaths: string[] = [];
    const filterHandledPathMatches: string[] = httpConfig.filterHandledRouteMatches || [];

    if (openApiDoc?.paths) {
      Object.keys(openApiDoc.paths).forEach((path) => {
        Object.keys(openApiDoc.paths[path]).forEach((method) => {
          const convertedPath: string = RouterUtil.openApiPathToRouteParserPath(path);
          const finder: string = method + ' ' + path;
          const applicableMeta: HttpMetaProcessingConfig = RouterUtil.findApplicableMeta(httpConfig, method, path);

          const entry: any = openApiDoc.paths[path][method];
          const isBackgroundEndpoint: boolean = path.startsWith(backgroundHttpAdapterHandler.backgroundHttpEndpointPrefix);
          // Auto-assign the background handler
          if (isBackgroundEndpoint) {
            rval.config.handlers.set(finder, (evt, ctx) => backgroundHttpAdapterHandler.handleBackgroundSubmission(evt, ctx));
          }

          if (!rval.config.handlers || !rval.config.handlers.get(finder)) {
            const match: string = filterHandledPathMatches.find((reg) => finder.match(reg));
            if (match) {
              Logger.debug('Adding filter-handled handler for %s', finder);
              // Insert a placeholder for these, which still handles them in runtime if the filter is misconfigured
              rval.config.handlers.set(finder, (evt) => BuiltInHandlers.expectedHandledByFilter(evt));
            } else {
              missingPaths.push(finder);
            }
          }

          if (entry && entry['security'] && entry['security'].length > 1) {
            throw new MisconfiguredError('Epsilon does not currently support multiple security (path was ' + finder + ')');
          }
          let authorizerName: string = entry['security'] && entry['security'].length == 1 ? Object.keys(entry['security'][0])[0] : null;
          if (isBackgroundEndpoint && backgroundHttpAdapterHandler.backgroundHttpEndpointAuthorizerName) {
            authorizerName = backgroundHttpAdapterHandler.backgroundHttpEndpointAuthorizerName;
          }

          const newRoute: RouteMapping = {
            path: convertedPath,
            method: method,
            function: rval.config.handlers.get(finder),
            authorizerName: applicableMeta.overrideAuthorizerName || authorizerName,
            metaProcessingConfig: applicableMeta,
            validation: null,
            outboundValidation: null,
          };

          // Add inbound validation, if available
          if (
            entry['requestBody'] &&
            entry['requestBody']['content'] &&
            entry['requestBody']['content']['application/json'] &&
            entry['requestBody']['content']['application/json']['schema']
          ) {
            // TODO: this is brittle as hell, need to firm up
            const schema: any = entry['requestBody']['content'];
            Logger.silly('Applying schema %j to %s', schema, finder);

            const modelName = this.findAndValidateModelName(
              method,
              path,
              schema,
              rval.config.overrideModelValidator || rval.openApiModelValidator
            );
            const required: boolean = BooleanRatchet.parseBool(entry['requestBody']['required']);
            const validation: RouteValidatorConfig = {
              extraPropertiesAllowed: true,
              emptyAllowed: !required,
              modelName: modelName,
            } as RouteValidatorConfig;

            newRoute.validation = validation;
          }

          // Add outbound validation, if available
          if (
            entry['responses'] &&
            entry['responses']['200'] &&
            entry['responses']['200']['content'] &&
            entry['responses']['200']['content']['application/json'] &&
            entry['responses']['200']['content']['application/json']['schema']
          ) {
            // TODO: this is brittle as hell, need to firm up
            const schema: any = entry['responses']['200']['content'];
            Logger.silly('Applying schema %j to %s', schema, finder);
            const modelName = this.findAndValidateModelName(
              method,
              path,
              schema,
              rval.config.overrideModelValidator || rval.openApiModelValidator
            );
            const validation: RouteValidatorConfig = {
              extraPropertiesAllowed: false,
              emptyAllowed: false, // Its a 200 response, must be non-null
              modelName: modelName,
            } as RouteValidatorConfig;

            newRoute.outboundValidation = validation;
          }

          rval.routes.push(newRoute);
        });
      });
    }

    if (missingPaths.length > 0) {
      throw new MisconfiguredError().withFormattedErrorMessage('Missing expected handlers : %j', missingPaths);
    }

    return rval;
  }

  private static findAndValidateModelName(method: string, path: string, schema: any, modelValidator: ModelValidator): string | undefined {
    let rval: string | undefined = undefined;
    const schemaPath: string = schema['application/json']['schema']['$ref'];
    const inlinePath: string = schema['application/json']['schema']['type'];
    if (schemaPath) {
      rval = schemaPath.substring(schemaPath.lastIndexOf('/') + 1);
      if (!modelValidator.fetchModel(rval)) {
        throw new MisconfiguredError(`Path ${method} ${path} refers to schema ${rval} but its not in the schema section`);
      }
    } else if (inlinePath) {
      rval = `${method}-${path}-requestBodyModel`;
      const model = schema['application/json']['schema'];
      modelValidator.addModel(rval, model);
    }
    return rval;
  }

  public static openApiPathToRouteParserPath(input: string): string {
    let rval: string = input;

    if (rval) {
      let sIdx: number = rval.indexOf('{');
      while (sIdx > -1) {
        const eIdx: number = rval.indexOf('}');
        rval = rval.substring(0, sIdx) + ':' + rval.substring(sIdx + 1, eIdx) + rval.substring(eIdx + 1);
        sIdx = rval.indexOf('{');
      }
    }

    return rval;
  }
}
