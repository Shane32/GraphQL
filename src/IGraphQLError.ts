/**
 * Represents an error returned by a GraphQL API.
 */
interface IGraphQLError {
    /**
     * The error message.
     */
    message: string;

    /**
     * The locations in the GraphQL query where the error occurred.
     */
    locations?: Array<{ line: number; column: number }>;

    /**
     * The path in the GraphQL query where the error occurred.
     */
    path?: Array<string | number>;

    /**
     * Additional extensions for the error.
     */
    extensions?: {
        /**
         * The error code.
         */
        code?: string;

        /**
         * An array of error codes.
         */
        codes?: string[];

        /**
         * Additional extension properties.
         */
        [key: string]: any;
    };
}

export default IGraphQLError;
