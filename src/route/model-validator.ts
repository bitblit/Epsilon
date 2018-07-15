import * as Validator from 'swagger-model-validator';
import * as fs from 'fs';
import * as yaml from 'node-yaml';
import {Response} from 'express';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {BadRequestError} from '../error/bad-request-error';


/**
 * Helper for validating endpoints
 */
export class ModelValidator {

    public static validate(modelName: string, modelObject: any, emptyAllowed: boolean = false,
                           extraPropertiesAllowed: boolean = true): string[] {
        let rval: string[] = [];
        const contents: Buffer = fs.readFileSync(`${__dirname}/../api-swagger-definition-template.yaml`);
        const swagger = yaml.parse(contents);
        const allModels = swagger['definitions'];

        Logger.info('Validating model %s all definitions are : %s', modelName, JSON.stringify(allModels));

        if (allModels && modelName && allModels[modelName]) {
            const validation = new Validator().validate(modelObject, allModels[modelName], allModels, emptyAllowed, extraPropertiesAllowed);

            if (validation.errorCount > 0) {
                rval = validation.errors;
            }
        } else {
            rval = ['Model named "' + modelName + '" not present in schema'];
        }
        return rval;
    }

    public static continueOnValidBody(res: Response, modelName: string, modelObject: any,
                                      emptyAllowed: boolean = false, extraPropertiesAllowed: boolean = true): boolean {
        const errors: any[] = ModelValidator.validate(modelName, modelObject, emptyAllowed, extraPropertiesAllowed);
        if (errors.length > 0) {
            const errorStrings: string[] = errors.map(x => {
                return String(x)
            });
            Logger.info('Found errors while validating %s object %s', modelName, JSON.stringify(errorStrings));
            res.status(400).json({errors: errorStrings});
            return false;
        } else {
            return true;
        }

    }

    public static validateBody(modelName: string, modelObject: any, emptyAllowed: boolean = false,
                               extraPropertiesAllowed: boolean = true): Promise<any> {
        const errors: any[] = ModelValidator.validate(modelName, modelObject, emptyAllowed, extraPropertiesAllowed);
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
