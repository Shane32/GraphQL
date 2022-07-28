import IGraphQLError from "./IGraphQLError";

interface IQueryResult<T> {
    data?: T | null,
    errors?: Array<IGraphQLError>,
    extensions?: any,
    networkError: boolean,
    size: number,
}

export default IQueryResult;
