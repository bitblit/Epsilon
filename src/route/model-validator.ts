import * as Validator from 'swagger-model-validator';
import * as fs from 'fs';
import * as yaml from 'node-yaml';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {BadRequestError} from '../error/bad-request-error';


/**
 * Helper for validating endpoints
 */
export class ModelValidator {

    private allModels: any;

    constructor(pathToSwagger:string)
    {
        const contents: Buffer = fs.readFileSync(pathToSwagger);
        const swagger = yaml.parse(contents);
        this.allModels = swagger['definitions'];
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
            Logger.info('Found errors while validating %s object %s', modelName, JSON.stringify(errorStrings));
            const newError: BadRequestError = new BadRequestError(...errorStrings);
            throw newError;
        } else {
            return Promise.resolve(modelObject);
        }
    }

}
