import {RouterConfig} from './router-config';
import * as yaml from 'node-yaml';
import {MisconfiguredError} from '../error/misconfigured-error';
import {ModelValidator} from './model-validator';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {AuthorizerFunction} from './authorizer-function';
import {HandlerFunction} from './handler-function';
import {RouteMapping} from './route-mapping';
import {RouteValidatorConfig} from './route-validator-config';
import {BooleanRatchet} from '@bitblit/ratchet/dist/common/boolean-ratchet';
import {DefaultCORSHandler} from '../default-cors-handler';
import {OpenApiConvertOptions} from './open-api-convert-options';

/**
 * Endpoints about the api itself
 */
export class RouterUtil {

    private constructor() {
    } // Prevent instantiation

    // Parses an open api file to create a router config
    public static openApiYamlToRouterConfig(yamlString: string, handlers: Map<string, HandlerFunction<any>>,
                                            authorizers: Map<string, AuthorizerFunction>,
                                            options: OpenApiConvertOptions =
                                                RouterUtil.createDefaultOpenApiConvertOptions()): RouterConfig {
        if (!yamlString) {
            throw new MisconfiguredError('Cannot configure, missing either yaml or cfg');
        }
        const doc = yaml.parse(yamlString);

        const rval: RouterConfig = {
            authorizers: authorizers,
            routes: []
        } as RouterConfig;

        const corsHandler: DefaultCORSHandler = new DefaultCORSHandler();

        if (doc['components'] && doc['components']['schemas']) {
            rval.modelValidator = ModelValidator.createFromParsedOpenApiObject(doc)
        }
        if (doc['components'] && doc['components']['securitySchemes']) {
            // Just validation, nothing to wire here
            Object.keys(doc['components']['securitySchemes']).forEach(sk => {
                if (!authorizers || !authorizers.get(sk)) {
                    throw new MisconfiguredError('Doc requires authorizer ' + sk + ' but not found in map');
                }
            })
        }

        if (doc['paths']) {
            Object.keys(doc['paths']).forEach(path => {
                Object.keys(doc['paths'][path]).forEach(method => {
                    const convertedPath: string = RouterUtil.openApiPathToRouteParserPath(path);

                    if (method.toLowerCase() === 'options' && options.autoCORSOptionHandler) {
                        rval.routes.push(
                            {
                                path: convertedPath,
                                method: method,
                                function: (evt) => corsHandler.handle(evt),
                                authorizerName: null,
                                disableAutomaticBodyParse: true,
                                disableQueryMapAssure: true,
                                disableHeaderMapAssure: true,
                                disablePathMapAssure: true,
                                validation: null
                            } as RouteMapping
                        );
                    } else {
                        const finder: string = method + ' ' + path;
                        const entry: any = doc['paths'][path][method];
                        if (!handlers || !handlers.get(finder)) {
                            throw new MisconfiguredError('Expected to find handler "' + finder + '" but not found');
                        }
                        if (entry && entry['security'] && entry['security'].length > 1) {
                            throw new MisconfiguredError(
                                'Epsilon does not currently support multiple security (path was ' + finder + ')');
                        }
                        const authorizerName: string = (entry['security'] && entry['security'].length == 1) ? (Object.keys(entry['security'][0])[0]) : null;


                        const newRoute: RouteMapping = {
                            path: convertedPath,
                            method: method,
                            function: handlers.get(finder),
                            authorizerName: authorizerName,
                            disableAutomaticBodyParse: options.disableAutomaticBodyParse,
                            disableQueryMapAssure: options.disableQueryMapAssure,
                            disableHeaderMapAssure: options.disableHeaderMapAssure,
                            disablePathMapAssure: options.disablePathMapAssure,
                            validation: null
                        } as RouteMapping;

                        if (entry['requestBody'] && entry['requestBody']['content'] && entry['requestBody']['content']['application/json']
                            && entry['requestBody']['content']['application/json']['schema']) {
                            // TODO: this is brittle as hell, need to firm up
                            const schema: any = entry['requestBody']['content'];
                            Logger.silly('Applying schema %j to %s', schema, finder);
                            const schemaPath: string = schema['application/json']['schema']['$ref'];
                            const schemaName: string = schemaPath.substring(schemaPath.lastIndexOf('/') + 1);
                            if (!rval.modelValidator.fetchModel(schemaName)) {
                                throw new MisconfiguredError('Path ' + finder + ' refers to schema ' + schemaName +
                                    ' but its not in the schema section');
                            }
                            const required: boolean = BooleanRatchet.parseBool(entry['requestBody']['required']);
                            const validation: RouteValidatorConfig = {
                                extraPropertiesAllowed: true,
                                emptyAllowed: !required,
                                modelName: schemaName
                            } as RouteValidatorConfig;

                            newRoute.validation = validation;
                        }

                        rval.routes.push(newRoute);
                    }
                })
            });
        }


        return rval;
    }

    public static openApiPathToRouteParserPath(input: string): string {
        let rval: string = input;

        if (rval) {
            let sIdx: number = rval.indexOf('{');
            while (sIdx > -1) {
                let eIdx: number = rval.indexOf('}');
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
            disablePathMapAssure: false
        } as OpenApiConvertOptions;
    }

}






