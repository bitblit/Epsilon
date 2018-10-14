export interface EpsilonAuthProvider {

    // If null is returned or an error is thrown, that is considered auth failure
    authenticate(principal: string, credentials: string): Promise<any>;

}
