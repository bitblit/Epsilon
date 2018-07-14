
export interface EpsilonJwtToken<T> {
    exp: number;
    iat: number;
    iss: string;
    sub: string;

    user: T;
    roles: string[];
}

