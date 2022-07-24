# Example TypeScript / React npm package

This is an example TypeScript Package ready to be published as a npm package in the GitHub Package Repository. It has been set up with automated tests and package publishing workflow using GitHub Actions CI/CD. It is made for GitHub + VS Code users.

This template demonstrates a react component to display playing cards.  The playing cards originated from https://www.me.uk/cards/ and are released under the CC0 license.

This template also demonstrates a jpg photo of a bridge, which originated from https://pixabay.com/photos/bridge-park-garden-japanese-garden-53769/ and is free for commerical use with no attribution required.

# Setup

- Clone the project as a template, or to save space, copy the files to a new repo excluding the images.
- Install [Visual Studio Code](https://code.visualstudio.com/download), optionally with [ES Lint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).
- Be sure to remove/update the license if necessary

# Code

Add js/ts/jsx/tsx files to the `src` folder.  Dependencies can be added by installing them via `npm install`, but then you may also need to define them as external modules within `config/webpack.config.js`.  React is already set up.  Be sure to install developer dependencies with `npm install --save-dev` so that they are not included in the package.

# Content

Images and fonts should already be configured properly to be included in the package.  They can be placed anywhere in the `src` folder, such as within `src/images`.

# Testing

Tests can be added in the `test` folder, or alongside the component in the `src` folder.  Tests must have an extension of `.test.tsx` (or ts/js/jsx).  Please review testing examples at https://reactjs.org/docs/testing-recipes.html or elsewhere.

When a pull request is created, tests will run on GitHub for the package.

# Building

When committing to `main`, `master`, or `develop`, the project will be packaged and published to GitHub Package Repository as `beta-###` where the number is the run number of the workflow.

# Releasing

To publish a package, issue a release on GitHub with a tag number that corresponds to a semantic version number, such as `1.0.0`. The package will be built with the specified version number and published to GitHub Package Repository for the active repo.  The package will be scoped to the repo owner name and have a package name identical to the repo name. So for the repo `SampleCompany/SampleProject`, the npm name will be `@samplecompany/sampleproject`.

# Configuration

The repository is configured as follows:

- Husky is used to lint commit messages via commitlint, but currently disabled (see `.husky/commit-msg`).
- Husky is used to enforce passing of tests before a commit; see `.husky/pre-commit` to disable.
- Packages build for cjs, esm, and umd -- CommonJS, ES Modules, and Universal Module Definition formats.  Typescript definitions are also included.
  - The umd module is webpacked, so it is minified and images may be inlined, etc. See `config/webpack.config.js`.
  - The cjs/esm modules are simply compiled by typescript, with the content bundled in their folders as well.
- There are tools used by the building process under `tools`
  - `cleanup` empties and removes the distribution folders; used prior to building
  - `packagejson` can rewrite the `package.json` file with a changed setting; currently unused
  - `updateurl` changes the `package.json` file as necessary based on the active repository name and specified version number; used when publishing
- There are GitHub CI scripts in `.github/workflows`:
  - `test.yml` executes `npm run test` and can be configured to run on different OSes or with different versions of Node. Currently set to Ubuntu and Node 14.
  - `publish.yml` updates the package name and version via the `updateurl` tool, and then builds and publishes the package to GitHub Package Repository.
- `.editorconfig`, `.eslintrc.js` and `.prettierrc.js` are used to configure editor options.
- Jest is used for tests; see `jest.config.js` and `config/fileTransformer.js`.
- [pinst](https://github.com/typicode/pinst) is used to solve [a problem of husky](https://typicode.github.io/husky/#/?id=yarn-2)

# Required tools and environment

You need to have [Node.js](https://nodejs.org/en/download/) installed. Node includes npm as its default package manager.

Open the whole package folder with a good code editor, preferably [Visual Studio Code](https://code.visualstudio.com/download). Consider installing VS Code extensions [ES Lint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).

- In the VS Code top menu: **Terminal** -> **New Terminal**
- The VS Code shortcut to format a code file is <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>F</kbd> on windows.

# Usage

To use the npm package you've created within an application, you'll need to authenticate to GitHub Packages and configure npm to pull scoped packages from the proper registry:

1. Create a GitHub Personal Access Token (PAT) as described [here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) with the `read:packages` permission.

2. Create add a `.npmrc` file in the same or parent folder as your application's `package.json` file as follows, assuming a repo of `SampleCompany/SampleProject`:

```
@samplecompany:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken="MYAUTHTOKEN"
```

Then you can add this package to your application simply by using `npm install`. Please consider security implications when committing a `.npmrc` file containing your PAT to a repository.

# More notes

See https://github.com/tomchen/example-typescript-package for more information about the basis of this template.
