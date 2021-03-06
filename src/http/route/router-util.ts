import { RouterConfig } from './router-config';
import yaml from 'js-yaml';
import { MisconfiguredError } from '../error/misconfigured-error';
import { ModelValidator } from './model-validator';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { AuthorizerFunction } from './authorizer-function';
import { HandlerFunction } from './handler-function';
import { RouteMapping } from './route-mapping';
import { RouteValidatorConfig } from './route-validator-config';
import { BooleanRatchet } from '@bitblit/ratchet/dist/common/boolean-ratchet';
import { OpenApiConvertOptions } from './open-api-convert-options';
import { ErrorProcessorFunction } from './error-processor-function';
import { BuiltInHandlers } from './built-in-handlers';
import { APIGatewayEvent, ProxyResult } from 'aws-lambda';
import { ResponseUtil } from '../response-util';

/**
 * Endpoints about the api itself
 */
export class RouterUtil {
  // Thin wrapper to implement the handler interface
  public static readonly DEFAULT_REFLECTIVE_CORS_OPTION_HANDLER: HandlerFunction<ProxyResult> = async (e) => {
    const rval: ProxyResult = RouterUtil.defaultReflectiveCorsOptionsFunction(e);
    return rval;
  };

  private constructor() {} // Prevent instantiation

  // Parses an open api file to create a router config
  public static openApiYamlToRouterConfig(
    yamlString: string,
    handlers: Map<string, HandlerFunction<any>>,
    authorizers: Map<string, AuthorizerFunction>,
    options: OpenApiConvertOptions = RouterUtil.createDefaultOpenApiConvertOptions(),
    errorProcessor: ErrorProcessorFunction = BuiltInHandlers.defaultErrorProcessor,
    defaultTimeoutMS?: number,
    customTimeouts: Map<string, number> = new Map<string, number>(),
    inCorsHandler: HandlerFunction<any> = null
  ): RouterConfig {
    if (!yamlString) {
      throw new MisconfiguredError('Cannot configure, missing either yaml or cfg');
    }
    const doc = yaml.load(yamlString);

    const rval: RouterConfig = {
      authorizers: authorizers,
      routes: [],
      errorProcessor: errorProcessor,
      defaultTimeoutMS: defaultTimeoutMS,
    } as RouterConfig;

    let corsHandler: HandlerFunction<any> = inCorsHandler;
    if (!corsHandler) {
      const corsOb: ProxyResult = RouterUtil.buildCorsResponse();
      corsHandler = async (e) => {
        return corsOb;
      };
    }

    if (doc['components'] && doc['components']['schemas']) {
      rval.modelValidator = ModelValidator.createFromParsedOpenApiObject(doc);
    }
    if (doc['components'] && doc['components']['securitySchemes']) {
      // Just validation, nothing to wire here
      Object.keys(doc['components']['securitySchemes']).forEach((sk) => {
        if (!authorizers || !authorizers.get(sk)) {
          throw new MisconfiguredError('Doc requires authorizer ' + sk + ' but not found in map');
        }
      });
    }

    const missingPaths: string[] = [];

    if (doc['paths']) {
      Object.keys(doc['paths']).forEach((path) => {
        Object.keys(doc['paths'][path]).forEach((method) => {
          const convertedPath: string = RouterUtil.openApiPathToRouteParserPath(path);

          if (method.toLowerCase() === 'options' && options.autoCORSOptionHandler) {
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
            } as RouteMapping);
          } else {
            const finder: string = method + ' ' + path;
            const entry: any = doc['paths'][path][method];
            if (!handlers || !handlers.get(finder)) {
              missingPaths.push(finder);
            }
            if (entry && entry['security'] && entry['security'].length > 1) {
              throw new MisconfiguredError('Epsilon does not currently support multiple security (path was ' + finder + ')');
            }
            const authorizerName: string = entry['security'] && entry['security'].length == 1 ? Object.keys(entry['security'][0])[0] : null;

            const timeoutMS: number = customTimeouts.get(finder) || defaultTimeoutMS;

            const newRoute: RouteMapping = {
              path: convertedPath,
              method: method,
              function: handlers.get(finder),
              authorizerName: authorizerName,
              disableAutomaticBodyParse: options.disableAutomaticBodyParse,
              disableQueryMapAssure: options.disableQueryMapAssure,
              disableHeaderMapAssure: options.disableHeaderMapAssure,
              disablePathMapAssure: options.disablePathMapAssure,
              timeoutMS: timeoutMS,
              validation: null,
            } as RouteMapping;

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
              const modelName = this.findAndValidateModelName(method, path, schema, rval.modelValidator);
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
              const modelName = this.findAndValidateModelName(method, path, schema, rval.modelValidator);
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

  public static createDefaultOpenApiConvertOptions(): OpenApiConvertOptions {
    return {
      autoCORSOptionHandler: true,
      disableAutomaticBodyParse: false,
      disableQueryMapAssure: false,
      disableHeaderMapAssure: false,
      disablePathMapAssure: false,
    } as OpenApiConvertOptions;
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

  public static buildCorsResponseForRouterConfig(cfg: RouterConfig): ProxyResult {
    return RouterUtil.buildCorsResponse(
      cfg.corsAllowedOrigins || '*',
      cfg.corsAllowedMethods || '*',
      cfg.corsAllowedHeaders || '*',
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
}
