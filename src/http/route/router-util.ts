import { EpsilonRouter } from './epsilon-router';
import yaml from 'js-yaml';
import { MisconfiguredError } from '../error/misconfigured-error';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { HandlerFunction } from './handler-function';
import { RouteMapping } from './route-mapping';
import { RouteValidatorConfig } from './route-validator-config';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { APIGatewayEvent, ProxyResult } from 'aws-lambda';
import { ResponseUtil } from '../response-util';
import { HttpConfig } from './http-config';
import { AuthorizerFunction } from './authorizer-function';
import { BuiltInHandlers } from './built-in-handlers';
import { OpenApiDocument } from '../../global/open-api/open-api-document';
import { ModelValidator } from '../../global/model-validator';
import { BackgroundQueueManager } from '../../background/background-queue-manager';

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

  public static assignDefaultsOnHttpConfig(cfg: HttpConfig): HttpConfig {
    const defaults: HttpConfig = {
      handlers: new Map<string, HandlerFunction<any>>(),
      authorizers: new Map<string, AuthorizerFunction>(),
      errorProcessor: BuiltInHandlers.defaultErrorProcessor,
      customCorsHandler: null,
      customTimeouts: new Map<string, number>(),
      staticContentPaths: [],
      customExtraHeaders: new Map<string, string>(),
      defaultErrorMessage: null, // Null because if set, it overrides the outbound even on dev,
      corsAllowedOrigins: '*',
      corsAllowedMethods: '*',
      corsAllowedHeaders: '*',
      webTokenManipulator: null,
      overrideModelValidator: null,
      prefixesToStripBeforeRouteMatch: [],
      requestIdResponseHeaderName: 'X-REQUEST-ID',
      disableAutoCORSOptionHandler: false,
      defaultTimeoutMS: 30_000,
      disableAutoFixStillEncodedQueryParams: false,
      disableAutoAddCorsHeadersToResponses: false,
      disableCompression: false,
      apolloRegex: null,
      apolloServer: null,
      apolloCreateHandlerOptions: null,
    };
    const rval: HttpConfig = Object.assign({}, defaults, cfg || {});
    return rval;
  }

  // Parses an open api file to create a router config
  public static openApiYamlToRouterConfig(
    httpConfig: HttpConfig,
    openApiDoc: OpenApiDocument,
    modelValidator: ModelValidator,
    backgroundManager: BackgroundQueueManager
  ): EpsilonRouter {
    if (!openApiDoc || !httpConfig) {
      throw new MisconfiguredError('Cannot configure, missing either yaml or cfg');
    }
    const rval: EpsilonRouter = {
      routes: [],
      openApiModelValidator: modelValidator,
      config: RouterUtil.assignDefaultsOnHttpConfig(httpConfig),
    };

    let corsHandler: HandlerFunction<any> = rval.config.customCorsHandler;
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

          if (method.toLowerCase() === 'options' && !rval.config.disableAutoCORSOptionHandler) {
            rval.routes.push({
              path: convertedPath,
              method: method,
              function: corsHandler,
              authorizerName: null,
              disableAutomaticBodyParse: true,
              disableQueryMapAssure: true,
              disableHeaderMapAssure: true,
              disablePathMapAssure: true,
              timeoutMS: 10000, // short timeouts for auto-generated CORS since its constant
              validation: null,
              outboundValidation: null,
              disableConvertNullReturnedObjectsTo404: false,
              allowLiteralStringNullAsQueryStringParameter: false,
              allowLiteralStringNullAsPathParameter: false,
              enableValidateOutboundResponseBody: false,
            });
          } else {
            const finder: string = method + ' ' + path;
            const entry: any = openApiDoc.paths[path][method];
            if (!rval.config.handlers || !rval.config.handlers.get(finder)) {
              missingPaths.push(finder);
            }
            if (entry && entry['security'] && entry['security'].length > 1) {
              throw new MisconfiguredError('Epsilon does not currently support multiple security (path was ' + finder + ')');
            }
            const authorizerName: string = entry['security'] && entry['security'].length == 1 ? Object.keys(entry['security'][0])[0] : null;

            const timeoutMS: number = rval.config.customTimeouts.get(finder) || rval.config.defaultTimeoutMS;

            const newRoute: RouteMapping = {
              path: convertedPath,
              method: method,
              function: rval.config.handlers.get(finder),
              authorizerName: authorizerName,
              disableAutomaticBodyParse: false,
              disableQueryMapAssure: false,
              disableHeaderMapAssure: false,
              disablePathMapAssure: false,
              timeoutMS: timeoutMS,
              validation: null,
              disableConvertNullReturnedObjectsTo404: false,
              allowLiteralStringNullAsPathParameter: false,
              allowLiteralStringNullAsQueryStringParameter: false,
              enableValidateOutboundResponseBody: false,
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

    if (httpConfig.backgroundSubmissionHandlerPath) {
      Logger.debug('Adding background mapped to %s', httpConfig.backgroundSubmissionHandlerPath);
      let routeMapping: RouteMapping = rval.routes.find((rm) => rm.path === httpConfig.backgroundSubmissionHandlerPath);

      if (!routeMapping) {
        // Define one on-the-fly
        routeMapping = {
          path: httpConfig.backgroundSubmissionHandlerPath,
          method: 'POST',
          function: (evt) => BuiltInHandlers.handleBackgroundSubmission(evt, backgroundManager),
          authorizerName: null,
          disableAutomaticBodyParse: false,
          disableQueryMapAssure: false,
          disableHeaderMapAssure: false,
          disablePathMapAssure: false,
          timeoutMS: httpConfig.defaultTimeoutMS,
          validation: null,
          disableConvertNullReturnedObjectsTo404: false,
          allowLiteralStringNullAsPathParameter: false,
          allowLiteralStringNullAsQueryStringParameter: false,
          enableValidateOutboundResponseBody: false,
          outboundValidation: null,
        };
        rval.routes.push(routeMapping);
      }
      if (httpConfig.backgroundSubmissionAuthorizerName) {
        routeMapping.authorizerName = httpConfig.backgroundSubmissionAuthorizerName;
      }
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

  public static buildCorsResponseForRouterConfig(cfg: EpsilonRouter): ProxyResult {
    return RouterUtil.buildCorsResponse(
      cfg.config.corsAllowedOrigins,
      cfg.config.corsAllowedMethods,
      cfg.config.corsAllowedHeaders,
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
}
