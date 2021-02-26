import Validator from 'swagger-model-validator';
import fs from 'fs';
import yaml from 'js-yaml';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { BadRequestError } from '../error/bad-request-error';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';

/**
 * Helper for validating endpoints
 */
export class ModelValidator {
  constructor(private allModels: any) {
    if (!allModels || Object.keys(allModels).length == 0) {
      ErrorRatchet.throwFormattedErr('Cannot create model validator, passed models was null/empty : %j', allModels);
    }
  }

  public static createFromOpenApiPath(pathToSwagger: string): ModelValidator {
    const contents: Buffer = fs.readFileSync(pathToSwagger);
    return ModelValidator.createFromOpenApiYaml(contents.toString());
  }

  public static createFromOpenApiYaml(yamlString: string): ModelValidator {
    const openApi = yaml.load(yamlString);
    return ModelValidator.createFromParsedOpenApiObject(openApi);
  }

  public static createFromParsedOpenApiObject(openApi: any): ModelValidator {
    if (!openApi || !openApi['components'] || !openApi['components']['schemas']) {
      throw new Error('Cannot use this yaml - either null, or missing path components/schemas');
    }
    return new ModelValidator(openApi['components']['schemas']);
  }

  public addModel(modelName: string, model: any): void {
    this.allModels[modelName] = model;
  }

  public fetchModel(modelName: string): any {
    return this.allModels[modelName];
  }

  public validate(modelName: string, modelObject: any, emptyAllowed: boolean = false, extraPropertiesAllowed: boolean = true): string[] {
    let rval: string[] = [];
    Logger.silly('Validating model %s all definitions are : %j', modelName, this.allModels);

    const modelEmpty: boolean = !modelObject || Object.keys(modelObject).length === 0;
    if (modelEmpty) {
      if (!emptyAllowed) {
        rval.push('Empty / null object sent, but empty not allowed here');
      }
    } else {
      if (this.allModels && modelName && this.allModels[modelName]) {
        const validation = new Validator().validate(
          modelObject,
          this.allModels[modelName],
          this.allModels,
          emptyAllowed,
          extraPropertiesAllowed
        );

        if (validation.errorCount > 0) {
          rval = validation.errors.map((e) => e.message);
        }
      } else {
        rval = ['Model named "' + modelName + '" not present in schema'];
      }
    }
    return rval;
  }

  public validateBody(
    modelName: string,
    modelObject: any,
    emptyAllowed: boolean = false,
    extraPropertiesAllowed: boolean = true
  ): Promise<any> {
    const errors: any[] = this.validate(modelName, modelObject, emptyAllowed, extraPropertiesAllowed);
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
