import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { ContextUtil } from '../util/context-util';

export class BuiltInTraceIdGenerators {
  public static fullAwsRequestId(): string {
    let rval: string = ContextUtil.currentRequestId();
    rval = rval ?? StringRatchet.createType4Guid();
    return rval;
  }

  public static shortAwsRequestId(): string {
    let rval: string = BuiltInTraceIdGenerators.fullAwsRequestId();
    if (rval.length > 10) {
      let idx: number = rval.lastIndexOf('-');
      idx = idx === -1 ? rval.length - 10 : idx;
      rval = rval.substring(idx);
    }
    return rval;
  }

  public static fixedLengthHex(length: number = 10): string {
    return StringRatchet.createRandomHexString(length);
  }
}
