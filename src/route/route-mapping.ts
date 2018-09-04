
export interface RouteMapping {
    method: string,
    path: string,
    handlerOb: any,
    handlerName: string,

    requiredRoles: string[];
}
