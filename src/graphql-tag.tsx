export default function gql(strings: TemplateStringsArray, ...params: string[]) {
    let value = strings[0] || "";

    for (let i = 1; i < strings.length; i++) {
        value += params[i - 1] + (strings[i] || "");
    }

    const ret = value.indexOf('"') === -1 ? value.replace(/[\s,]+/g, " ").trim() : value;
    if (ret.indexOf("undefined") >= 0) {
        console.error("gql error", arguments, strings, params, ret);
    }
    return ret;
}
