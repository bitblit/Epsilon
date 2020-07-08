import * as yaml from 'js-yaml';
import { OpenApiDocModifications } from './open-api-doc-modifications';
import { Logger } from '@bitblit/ratchet/dist/common/logger';

/**
 * Monitoring endpoints
 */
export class OpenApiDocModifier {
  constructor(private options: OpenApiDocModifications) {}

  public modifyOpenApiDoc(yamlString: string): string {
    let rval: string;
    if (!!yamlString && !!this.options) {
      try {
        const openApi: any = yaml.load(yamlString);
        const removeTags: string[] = this.options.removeTags ? this.options.removeTags.map((t) => t.toLowerCase()) : [];

        // Apply new server path
        if (this.options.newServerPath) {
          openApi['servers'] = [{ url: this.options.newServerPath }];
        }

        if (!!this.options.removeTags && openApi['tags']) {
          if (openApi['tags']) {
            openApi['tags'] = openApi.tags.filter((f) => {
              const n: string = !!f && !!f['name'] ? f['name'].toLowerCase() : '';
              const i: number = removeTags.indexOf(n);
              return i === -1;
            });
          }
        }

        if (openApi['paths']) {
          let newPaths: any = {};
          Object.keys(openApi['paths']).forEach((p) => {
            let path: any = openApi['paths'][p];
            Object.keys(path).forEach((verb) => {
              let entry: any = path[verb];
              entry.tags = !!entry.tags ? entry.tags.filter((t) => removeTags.lastIndexOf(t.toLowerCase()) == -1) : entry.tags;
              const matcher: string = verb.toLowerCase() + ' ' + p.toLowerCase();
              if (this.matchNone(matcher, this.options.removeEndpoints)) {
                newPaths[p] = newPaths[p] || {};
                newPaths[p][verb] = entry;
              }
            });
          });

          if (this.options.sortEndpoints) {
            const keys: string[] = Object.keys(newPaths).sort();
            const newPaths2: any = {};
            keys.forEach((k) => {
              newPaths2[k] = newPaths[k];
            });
            newPaths = newPaths2;
          }
          openApi['paths'] = newPaths;
        }

        // Sort the schemas and remove any that are marked for removal
        let remSchemas: string[] = this.options.removeSchemas || [];
        remSchemas = remSchemas.map((s) => s.toLowerCase());
        if (openApi['components'] && openApi['components']['schemas']) {
          const keys: string[] = Object.keys(openApi['components']['schemas']).sort();
          const newComp: any = {};
          keys.forEach((k) => {
            if (remSchemas.indexOf(k.toLowerCase()) === -1) {
              newComp[k] = openApi['components']['schemas'][k];
            }
          });
          openApi['components']['schemas'] = newComp;
        }

        rval = yaml.dump(openApi);
      } catch (err) {
        Logger.error('Error processing yaml: %s', err, err);
      }
    }
    return rval;
  }

  private matchNone(input: string, regex: RegExp[]): boolean {
    let rval: boolean = true;
    if (!!input && !!regex) {
      regex.forEach((r) => {
        rval = rval && !r.test(input);
      });
    }
    return rval;
  }
}
