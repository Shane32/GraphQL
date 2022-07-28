import IGraphQLError from "./IGraphQLError";
import IQueryResult from "./IQueryResult";

export default class GraphQLError {
    public graphQLErrors: Array<IGraphQLError> | undefined;
    public networkError: any;
    public message: string;
    public response: IQueryResult<any>;
    public constructor(data: IQueryResult<any>) {
        this.response = data;
        if (data.networkError) {
            this.message = data.errors![0].message;
        } else {
            this.graphQLErrors = data.errors;
            this.message = data.errors && data.errors.length ? data.errors[0].message : "Unknown error";
        }
    }
}
