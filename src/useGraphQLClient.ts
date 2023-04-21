import { useContext } from "react";
import GraphQLContext from "./GraphQLContext";
import IGraphQLClient from "./IGraphQLClient";

/**
 * Returns the configured GraphQL client for the current context, or throws an error if the client is not found.
 *
 * @param {IGraphQLClient | string} client The name of the client to use, or the client itself.
 * @param {boolean} guest Whether to use the guest client.
 * @returns {IGraphQLClient} The configured GraphQL client for the current context.
 * @throws {Error} If the specified client is not found in the context.
 */
const useGraphQLClient = (
    client?: IGraphQLClient | string,
    guest?: boolean
) => {
    const context = useContext(GraphQLContext);
    let client2 = typeof client !== "string" && client;

    // If a specific client was not provided, look it up in the context
    if (!client2) {
        // Use the client name if provided, otherwise the default or guest client as applicable
        const clientName =
            (typeof client === "string" && client) ||
            (guest && "guest") ||
            "client";
        client2 = context[clientName];
        if (!client2) {
            throw new Error(`Cannot find GraphQL client '${clientName}'`);
        }
    }

    return client2;
};

export default useGraphQLClient;
