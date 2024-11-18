# GraphQL Codegen Setup Guide

This guide provides step-by-step instructions to configure and use GraphQL Codegen in your project.

## 1. Install Dependencies

Start by installing the necessary development dependencies:

```bash
npm install --save-dev @graphql-codegen/cli @graphql-codegen/schema-ast @parcel/watcher @graphql-codegen/near-operation-file-preset concurrently @0no-co/graphqlsp
```

- `@graphql-codegen/cli`: Core CLI tool to run code generation.
- `@graphql-codegen/schema-ast`: Plugin for generating a schema file from your GraphQL API endpoint (optional if you already have a schema file).
- `@parcel/watcher`: Enables watch mode for the codegen CLI, which automatically updates files.
- `@graphql-codegen/near-operation-file-preset`: Preset to generate TypeScript types near your GraphQL operations for better organization.
- `concurrently`: Allows running multiple scripts concurrently, useful for combining watch mode and other tasks.
- `@0no-co/graphqlsp`: TypeScript LSP Plugin that will recognise documents in your TypeScript code and help you out with hover-information, diagnostics and auto-complete.

## 2. GraphQL Schema and Routing (skip if you already have a schema url to provide in the next step)

In order for graphql-codegen to generate the necessary types and queries, you need to provide a GraphQL schema to download from. This example generates an SDL file.

**This part assumes you have a .NET application with a GraphQL server set up.**

In your `Startup.cs` (or wherever your `IApplicationBuilder` code is), add or modify your code to configure the GraphQL schema like so:

```csharp
var schema = app.ApplicationServices.GetRequiredService<ISchema>();
var sdlBytes = System.Text.Encoding.UTF8.GetBytes(schema.Print(new() {
    IncludeDeprecationReasons = true,
    IncludeDescriptions = true,
    StringComparison = StringComparison.InvariantCultureIgnoreCase,
}));

app.UseEndpoints(endpoints => {
    // ...your existing code in here, if any...

    endpoints.MapGet("/api/graphqlschema/add-guid-here", async context => {
        context.Response.ContentType = "application/graphql; charset=utf-8";
        context.Response.StatusCode = 200;
        await context.Response.Body.WriteAsync(sdlBytes, context.RequestAborted);
    });

    endpoints.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}");
});
```

**Be sure to replace "add-guid-here" with an actual GUID.**

Refer to [this example](https://github.com/Shane32/ContractManager/blob/596f9c20014234380fb7f38cad02d5cdae1704bb/ContractManagerTests/Infrastructure/ServerTests.cs) for adding in a test for your SDL schema.

## 3. Create the `codegen.ts` Configuration File

In the root of your project, add a `codegen.ts` file with the following content:

```typescript
import type { CodegenConfig } from "@graphql-codegen/cli";

const schemaUrl = "your-schema-url";

const config: CodegenConfig = {
  schema: [{ [schemaUrl]: { handleAsSDL: true } }],
  documents: "./src/**/!(*.g).{ts,tsx}",
  ignoreNoDocuments: true,
  generates: {
    ["./src/graphql/types.g.ts"]: {
      plugins: ["typescript"],
      config: {
        scalars: {
          DateOnly: "string",
          DateTimeOffset: "string",
          Decimal: "number",
          Uri: "string",
        },
      },
    },
    [`./src`]: {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".g.ts",
        baseTypesPath: "/graphql/types.g.ts",
      },
      plugins: ["typescript-operations", "typed-document-node"],
      config: {
        documentMode: "string",
      },
    },
    ["./schema.g.graphql"]: {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
```

**Make sure to replace "your-schema-url" with the actual URL of your GraphQL schema.**

## 4. Setup @0no-co/graphqlsp

Modify the `tsconfig.json` to include the @no-co/graphqlsp plugin:

```json
{
  "compilerOptions": {
    ... other configurations ...
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.g.graphql",
        "templateIsCallExpression": false
      }
    ]
  }
}
```

Then we need to prompt Visual Studio Code to use the local TypeScript version by creating a `.vscode/settings.json` file with the following contents:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## 5. Run Codegen

To generate the `schema.g.graphql` file and GraphQL client code, run:

```bash
npx graphql-codegen
```

For automatic updates as you modify your queries and mutations, use the `--watch` flag:

```bash
npx graphql-codegen --watch
```

After running, you should see:

- `schema.g.graphql` in your project root.
- `src/graphql/types.g.ts` with generated types for your GraphQL schema.
- `.g.ts` files alongside your query and mutation specific `.ts` files for your GraphQL operations.

**Note:** You don't need to manually edit files within `src/graphql` as they are auto-generated.

## 6. Update Package Scripts

**This part assumes that you are using Vite. If not, change what you need to accordingly.**

Modify your `package.json` scripts to integrate GraphQL Codegen with your development and build processes:

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"graphql-codegen --watch\"",
    "build": "graphql-codegen && tsc && vite build"
  }
}
```

This setup ensures that:

- During development (`npm run dev`), both the Vite dev server and GraphQL Codegen watch mode run simultaneously
- During build (`npm run build`), GraphQL types are generated before the TypeScript compilation and Vite build process

## 7. Writing Queries and Mutations

Place `.ts` files containing your queries and mutations alongside the components using them. The file name of your queries and mutations should be something like this: `{Component Name}Queries.ts`. For example, if you had a component named `MyComponent.tsx`, your query and mutation file should be `MyComponentQueries.ts`.

 A sample query might look like this:

```typescript
import { gql } from "@shane32/graphql";

gql`
  query Bank($id: ID!) {
    bank(id: $id) {
      name
    }
  }
`;
```

**All queries and mutations must have an operation name that is unique across the whole application.**

Once saved, a `.g.ts` file with a matching document will be created next to your component, which you can then import and use in React components:

```typescript
import * as Queries from "./EditBankAccount.g";
import { useQuery } from "@shane32/graphql";

const { data, loading, error } = useQuery(Queries.BankAccountDocument, {
  variables: skip ? undefined : { id: id },
  skip: skip,
  fetchPolicy: "cache-and-network",
});
```

---

## Important Changes for `prettier` and `eslint`

Make sure to include a `.prettierignore` file containing this:

```
**/*.g.ts
**/*.g.tsx
**/*.g.graphql
```

In your `.eslintrc.cjs` (or equivalent file), you need to add (or change) the `ignorePatterns` to this:

```json
{
  "ignorePatterns": ["dist", ".eslintrc.cjs", "*.g.ts", "*.g.tsx", "vite.config.ts", "codegen.ts"]
}
```

**If you changed this file after running the "npm run dev" (or equivalent) command, you should stop and start the command you ran again.**