import { ApolloServer, CreateHandlerOptions } from 'apollo-server-lambda';

export interface ApolloGraphqlConfig {
  pathRegex?: RegExp;
  apolloServer?: ApolloServer;
  createHandlerOptions?: CreateHandlerOptions;
}
