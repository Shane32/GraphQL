interface IGraphQLError {
    message: string,
    locations?: Array<{ line: number, column: number }>,
    path?: Array<string | number>,
    extensions?: {
        code?: string,
        codes?: string[],
        [key: string]: any,
    }
}

export default IGraphQLError;
