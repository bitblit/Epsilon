import * as Validator from 'swagger-model-validator';
import * as fs from 'fs';
import * as yaml from 'node-yaml';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {BadRequestError} from '../error/bad-request-error';


/**
 * Helper for validating endpoints
 */
export class ModelValidator {


    constructor(private allModels: any) {
        if (!allModels || Object.keys(allModels).length==0) {
            throw new Error('Cannot create model validator, passed models was null/empty : '+JSON.stringify(allModels));
        }
    }

    public static createFromOpenApiPath(pathToSwagger: string): ModelValidator {
        const contents: Buffer = fs.readFileSync(pathToSwagger);
        return ModelValidator.createFromOpenApiYaml(contents.toString());
    }

    public static createFromOpenApiYaml(yamlString: string): ModelValidator {
        const openApi = yaml.parse(yamlString);
        return ModelValidator.createFromParsedOpenApiObject(openApi);
    }

    public static createFromParsedOpenApiObject(openApi: any): ModelValidator {
        if (!openApi || !openApi['components'] || !openApi['components']['schemas']) {
            throw new Error('Cannot use this yaml - either null, or missing path components/schemas');
        }
        return new ModelValidator(openApi['components']['schemas']);
    }

    public fetchModel(modelName: string): any {
        return this.allModels[modelName];
    }

    public validate(modelName: string, modelObject: any, emptyAllowed: boolean = false,
                           extraPropertiesAllowed: boolean = true): string[] {

        Logger.info('Validating model %s all definitions are : %j', modelName, this.allModels);

        let rval: string[] = [];

        if (this.allModels && modelName && this.allModels[modelName]) {
            const validation = new Validator().validate(modelObject, this.allModels[modelName], this.allModels, emptyAllowed, extraPropertiesAllowed);

            if (validation.errorCount > 0) {
                rval = validation.errors;
            }
        } else {
            rval = ['Model named "' + modelName + '" not present in schema'];
        }
        return rval;
    }

    public validateBody(modelName: string, modelObject: any, emptyAllowed: boolean = false,
                               extraPropertiesAllowed: boolean = true): Promise<any> {
        const errors: any[] = this.validate(modelName, modelObject, emptyAllowed, extraPropertiesAllowed);
        if (errors.length > 0) {
            const errorStrings: string[] = errors.map(x => {
                return String(x)
            });
            Logger.info('Found errors while validating %s object %j', modelName, errorStrings);
            const newError: BadRequestError = new BadRequestError(...errorStrings);
            throw newError;
        } else {
            return Promise.resolve(modelObject);
        }
    }

}
