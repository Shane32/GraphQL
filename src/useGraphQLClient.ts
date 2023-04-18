import { useContext } from "react";
import GraphQLContext from "./GraphQLContext";
import IGraphQLClient from "./IGraphQLClient";

const useGraphQLClient = (client?: IGraphQLClient | string, guest?: boolean) => {
    const context = useContext(GraphQLContext);
    let client2 = typeof client !== "string" && client;
    if (!client2) {
        const clientName = (typeof client === "string" && client) || (guest && "guest") || "client";
        client2 = context[clientName];
        if (!client2) {
            throw new Error(`Cannot find GraphQL client '${clientName}'`);
        }
    }
    return client2;
}

export default useGraphQLClient;
