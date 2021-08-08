import { EpsilonRouter } from './epsilon-router';
import { MisconfiguredError } from '../error/misconfigured-error';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { RouteMapping } from './route-mapping';
import { RouteValidatorConfig } from './route-validator-config';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { APIGatewayEvent, ProxyResult } from 'aws-lambda';
import { ResponseUtil } from '../response-util';
import { OpenApiDocument } from '../../config/open-api/open-api-document';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { BadRequestError } from '../error/bad-request-error';
import { BackgroundHttpAdapterHandler } from '../../background/background-http-adapter-handler';
import { HandlerFunction } from '../../config/http/handler-function';
import { HttpConfig } from '../../config/http/http-config';
import { AuthorizerFunction } from '../../config/http/authorizer-function';
import { BuiltInHandlers } from '../../built-in/http/built-in-handlers';
import { HttpMetaProcessingConfig } from '../../config/http/http-meta-processing-config';
import { NullReturnedObjectHandling } from '../../config/http/null-returned-object-handling';
import { MappedHttpMetaProcessingConfig } from '../../config/http/mapped-http-meta-processing-config';

/**
 * Endpoints about the api itself
 */
export class RouterUtil {
  // Thin wrapper to implement the handler interface
  public static readonly DEFAULT_REFLECTIVE_CORS_OPTION_HANDLER: HandlerFunction<ProxyResult> = async (e) => {
    const rval: ProxyResult = RouterUtil.defaultReflectiveCorsOptionsFunction(e);
    return rval;
  };

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static defaultHttpMetaProcessingConfig(): HttpMetaProcessingConfig {
    const defaults: HttpMetaProcessingConfig = {
      configName: 'EpsilonDefaultHttpMetaProcessingConfig',
      timeoutMS: 30_000,
      overrideAuthorizerName: null,
      customExtraHeaders: {},
      defaultErrorMessage: 'Internal server error',
      corsAllowedOrigins: '*',
      corsAllowedMethods: '*',
      corsAllowedHeaders: '*',
      disableAutoFixStillEncodedQueryParams: false,
      disableAutoAddCorsHeadersToResponses: false,
      disableCompression: false,
      disableValidateInboundRequestBody: false,
      disableValidateInboundQueryParameters: false,
      enableValidateOutboundResponseBody: false,
      disableAutomaticBodyParse: false,
      disableParameterMapAssure: false,
      nullReturnedObjectHandling: NullReturnedObjectHandling.Return404NotFoundResponse,
      allowLiteralStringNullAsPathParameter: false,
      allowLiteralStringNullAsQueryStringParameter: false,
    };
    return defaults;
  }

  public static assignDefaultsOnHttpConfig(cfg: HttpConfig): HttpConfig {
    const defaults: HttpConfig = {
      handlers: new Map<string, HandlerFunction<any>>(),
      authorizers: new Map<string, AuthorizerFunction>(),
      errorProcessor: BuiltInHandlers.defaultErrorProcessor,
      defaultMetaHandling: this.defaultHttpMetaProcessingConfig(),
      staticContentRoutes: {},
      webTokenManipulator: null,
      prefixesToStripBeforeRouteMatch: [],
      requestIdResponseHeaderName: 'X-REQUEST-ID',
      apolloConfig: null,
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

    let corsHandler: HandlerFunction<any> = rval.config.customOptionsRequestHandler;
    if (!corsHandler) {
      const corsOb: ProxyResult = RouterUtil.buildCorsResponse();
      corsHandler = async (e) => {
        return corsOb;
      };
    }

    if (openApiDoc?.components?.securitySchemes) {
      // Just validation, nothing to wire here
      Object.keys(openApiDoc.components.securitySchemes).forEach((sk) => {
        if (!rval.config.authorizers || !rval.config.authorizers.get(sk)) {
          throw new MisconfiguredError('Doc requires authorizer ' + sk + ' but not found in map');
        }
      });
    }

    const missingPaths: string[] = [];

    if (openApiDoc?.paths) {
      Object.keys(openApiDoc.paths).forEach((path) => {
        Object.keys(openApiDoc.paths[path]).forEach((method) => {
          const convertedPath: string = RouterUtil.openApiPathToRouteParserPath(path);
          const finder: string = method + ' ' + path;
          const applicableMeta: HttpMetaProcessingConfig = RouterUtil.findApplicableMeta(httpConfig, method, path);

          if (method.toLowerCase() === 'options') {
            applicableMeta.timeoutMS = 10_000; // Options calls get really short timeouts since they are constant
            rval.routes.push({
              path: convertedPath,
              method: method,
              function: corsHandler,
              authorizerName: null,
              metaProcessingConfig: applicableMeta,
              validation: null,
              outboundValidation: null,
            });
          } else {
            const entry: any = openApiDoc.paths[path][method];
            const isBackgroundEndpoint: boolean = path.startsWith(backgroundHttpAdapterHandler.backgroundHttpEndpointPrefix);
            // Auto-assign the background handler
            if (isBackgroundEndpoint) {
              rval.config.handlers.set(finder, (evt, ctx) => backgroundHttpAdapterHandler.handleBackgroundSubmission(evt, ctx));
            }

            if (!rval.config.handlers || !rval.config.handlers.get(finder)) {
              missingPaths.push(finder);
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
          }
        });
      });
    }

    if (missingPaths.length > 0) {
      throw new MisconfiguredError('Missing expected handlers : "' + JSON.stringify(missingPaths));
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

  public static buildCorsResponse(
    allowedOrigins: string = '*',
    allowedMethods: string = '*',
    allowedHeaders: string = '*',
    body: string = '{"cors":true}',
    statusCode: number = 200
  ): ProxyResult {
    const rval: ProxyResult = {
      statusCode: statusCode,
      body: body,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins || '*',
        'Access-Control-Allow-Methods': allowedMethods || '*',
        'Access-Control-Allow-Headers': allowedHeaders || '*',
      },
    };
    return rval;
  }

  public static buildCorsResponseForRouterConfig(config: HttpMetaProcessingConfig): ProxyResult {
    return RouterUtil.buildCorsResponse(
      config.corsAllowedOrigins,
      config.corsAllowedMethods,
      config.corsAllowedHeaders,
      '{"cors":true}',
      200
    );
  }

  public static defaultReflectiveCorsOptionsFunction(evt: APIGatewayEvent): ProxyResult {
    const corsResponse: ProxyResult = RouterUtil.buildCorsResponse(
      ResponseUtil.buildReflectCorsAllowOrigin(evt, '*'),
      ResponseUtil.buildReflectCorsAllowMethods(evt, '*'),
      ResponseUtil.buildReflectCorsAllowHeaders(evt, '*'),
      '',
      204
    );
    return corsResponse;
  }

  public static findRoute(router: EpsilonRouter, routeMethod: string, routePath: string): RouteMapping {
    return (router?.routes || []).find((r) => r.path === routePath && r.method === routeMethod);
  }

  public static validateBodyAndThrowHttpException(
    validator: ModelValidator,
    modelName: string,
    modelObject: any,
    emptyAllowed: boolean = false,
    extraPropertiesAllowed: boolean = true
  ): Promise<any> {
    const errors: any[] = validator.validate(modelName, modelObject, emptyAllowed, extraPropertiesAllowed);
    if (errors.length > 0) {
      const errorStrings: string[] = errors.map((x) => {
        return String(x);
      });
      Logger.info('Found errors while validating %s object %j', modelName, errorStrings);
      const newError: BadRequestError = new BadRequestError(...errorStrings);
      throw newError;
    } else {
      return Promise.resolve(modelObject);
    }
  }
}
