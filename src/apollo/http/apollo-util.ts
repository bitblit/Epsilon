import { BaseContext } from '@apollo/server';
import { EpsilonLambdaApolloContextFunctionArgument } from './epsilon-lambda-apollo-context-function-argument';
import { EventUtil } from '../../http/event-util';
import { ExpiredJwtHandling, JwtRatchetLike, JwtTokenBase, Logger, MapRatchet } from '@bitblit/ratchet/common';
import { DefaultEpsilonApolloContext } from './default-epsilon-apollo-context';
import { StringRatchet } from '@bitblit/ratchet/common';
import { UnauthorizedError } from '../../http/error/unauthorized-error';

export class ApolloUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  //const defaultContextFn: ContextFunction<[EpsilonLambdaApolloContextFunctionArgument], any> = async () => ({});

  public static async emptyContext<T extends BaseContext>(): Promise<T> {
    return {} as T;
  }

  public static async defaultEpsilonApolloContext(
    args: EpsilonLambdaApolloContextFunctionArgument,
    jwt?: JwtRatchetLike,
  ): Promise<DefaultEpsilonApolloContext<any>> {
    const authTokenSt: string = EventUtil.extractBearerTokenFromEvent(args.lambdaEvent);
    let token: JwtTokenBase = null;
    if (StringRatchet.trimToNull(authTokenSt) && jwt) {
      Logger.info('Got : %s', authTokenSt);
      token = await jwt.decodeToken(authTokenSt, ExpiredJwtHandling.RETURN_NULL);
    }

    const rval: DefaultEpsilonApolloContext<any> = {
      user: token,
      bearerTokenString: authTokenSt,
      headers: args.lambdaEvent.headers,
      functionName: args.lambdaContext.functionName,
      lambdaEvent: args.lambdaEvent,
      lambdaContext: args.lambdaContext,
    };
    return rval;
  }

  public static async nonRouteableOnlyEpsilonApolloContext(
    args: EpsilonLambdaApolloContextFunctionArgument,
    jwt?: JwtRatchetLike,
  ): Promise<DefaultEpsilonApolloContext<any>> {
    const hostName: string = StringRatchet.trimToNull(MapRatchet.extractValueFromMapIgnoreCase(args.lambdaEvent.headers, 'host'));
    const hostIsLocalOrNotRoutableIP4: boolean = EventUtil.hostIsLocalOrNotRoutableIP4(hostName);
    if (!hostIsLocalOrNotRoutableIP4) {
      throw new UnauthorizedError('May only run local / non-routeable : ' + hostName);
    }

    return ApolloUtil.defaultEpsilonApolloContext(args, jwt);
  }
}
