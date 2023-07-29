import { APIGatewayEvent, Context } from 'aws-lambda';

export interface EpsilonLambdaApolloContextFunctionArgument {
  lambdaEvent: APIGatewayEvent;
  lambdaContext: Context;
}
