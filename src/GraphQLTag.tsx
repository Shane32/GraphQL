/**
 * Returns a sanitized and trimmed GraphQL query string.
 *
 * @param strings An array of string literals for the query.
 * @param params The parameters for the query, if any.
 * @returns The sanitized and trimmed GraphQL query string.
 */
export default function gql(strings: TemplateStringsArray, ...params: string[]) {
    let value = strings[0] || "";

    for (let i = 1; i < strings.length; i++) {
        value += params[i - 1] + (strings[i] || "");
    }

    const ret = value.indexOf('"') === -1 ? value.replace(/[\s,]+/g, " ").trim() : value;

    // Log an error if the query contains undefined values
    if (ret.indexOf("undefined") >= 0) {
        console.error("gql error", arguments, strings, params, ret);
    }

    return ret;
}
