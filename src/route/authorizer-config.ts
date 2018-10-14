export interface AuthorizerConfig {
    name: string;

    handlerOb: any;
    handlerName: string; // optional, otherwise defaults to 'authHandler'
}

