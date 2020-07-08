/*
    Functions to combine a set of yaml files
*/

import * as fs from 'fs';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';
import * as yaml from 'js-yaml';
import { Logger } from '@bitblit/ratchet/dist/common/logger';

export class YamlCombiner {
  public static combine(files: string[], inRootPath: string[] = []): string {
    RequireRatchet.notNullOrUndefined(files, 'Files argument');
    RequireRatchet.true(files.length > 0, 'Files argument larger than 0');
    RequireRatchet.notNullOrUndefined(inRootPath, 'Root path argument');
    Logger.info('Processing %d files into output', files.length);

    let allElements: {} = {};
    for (let i = 0; i < files.length; i++) {
      const fileContents: string = fs.readFileSync(files[i]).toString();
      const openApi: any = yaml.load(fileContents);
      allElements = Object.assign(allElements, openApi);
    }
    let rootPath: string[] = Object.assign([], inRootPath);
    while (rootPath.length > 0) {
      const next: any = {};
      next[rootPath[rootPath.length - 1]] = allElements;
      rootPath.splice(rootPath.length - 1, 1);
      allElements = next;
    }

    const rval: string = yaml.dump(allElements);
    return rval;
  }
}
