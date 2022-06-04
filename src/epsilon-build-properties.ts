import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';

export class EpsilonBuildProperties {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static get buildVersion(): string {
    return 'LOCAL-SNAPSHOT';
  }

  public static get buildHash(): string {
    return 'LOCAL-HASH';
  }

  public static get buildBranch(): string {
    return 'LOCAL-BRANCH';
  }

  public static get buildTag(): string {
    return 'LOCAL-TAG';
  }

  public static get buildBranchOrTag(): string {
    return StringRatchet.trimToNull(EpsilonBuildProperties.buildBranch)
      ? 'BRANCH:' + EpsilonBuildProperties.buildBranch
      : 'TAG:' + EpsilonBuildProperties.buildTag;
  }

  public static get buildTime(): string {
    return 'LOCAL-TIME';
  }
}
