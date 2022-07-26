import GraphQLClient from "./GraphQLClient"

test('executeQueryRaw', async () => {
    const client = new GraphQLClient({
        url: "https://api.zbox.com/api/graphql",
    });
    const ret = client.ExecuteQueryRaw<{ v1: { info: { version:string } } }>("{v1{info{version}}}")
    const result = await ret.result;
    expect(result.data).toBeTruthy();
    expect(result.data!.v1.info.version).toBeTruthy();
})
