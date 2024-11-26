// Usage:
//
// node prepare-publish.js [key1] [value1] [key2] [value2] ... [keyN] [valueN]
//
// The script rewrites the ../package.json file with the specified allowed fields.
// Optionally, you can pass key - value pairs as command line arguments to add or
// update fields in the package.json file.

const fs = require("fs");
const Path = require("path");

// Load the package.json file
const fileName = "../package.json";
const packageJson = require(fileName);

// Define the allowed fields to be included in the package.json file
const allowedFields = [
  "name",
  "version",
  "description",
  "main",
  "module",
  "umd:main",
  "types",
  "sideEffects",
  "publishConfig",
  "files",
  "keywords",
  "author",
  "license",
  "homepage",
  "repository",
  "bugs",
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "engines",
];

// Initialize an empty object for the new package.json
const packagePublishJson = {};

// Iterate over the allowed fields and copy the corresponding values
allowedFields.forEach((field) => {
  if (packageJson[field] !== undefined) {
    packagePublishJson[field] = packageJson[field];
  }
});

// Get command line arguments (key-value pairs) to add or update fields
const args = process.argv.slice(2);
for (let i = 0, l = args.length; i < l; i++) {
  // Check if the index is even (keys)
  if (i % 2 === 0) {
    // Add or update the key with the corresponding value
    packagePublishJson[args[i]] = args[i + 1];
  }
}

// Write the package.json file to disk with the generated content
fs.writeFile(Path.join(__dirname, fileName), JSON.stringify(packagePublishJson, null, 2), (err) => {
  if (err) {
    return console.log(err);
  }
  console.log("Writing to " + fileName);
});
