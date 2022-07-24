/* eslint-disable */
const fs = require('fs')
const Path = require('path')
const fileName = '../package.json'
const file = require(fileName)
/* eslint-enable */

const args = process.argv.slice(2)

/*
 * this file opens package.json and makes some modifications for publishing to GPR
 * it is expected that this is run with two arguments:
 *   1: author/repo  (e.g. Shane32/playingcards)
 *   2: version      (e.g. 1.0.0)
 */

const authorRepo = args[0].toLowerCase();
file.name = '@' + authorRepo;
file.version = args[1];
file.repository.url = 'git@github.com:' + authorRepo + '.git';
file.bugs.url = 'https://github.com/' + authorRepo + '/issues';
file.homepage = 'https://github.com/' + authorRepo;

fs.writeFile(
  Path.join(__dirname, fileName),
  JSON.stringify(file, null, 2),
  (err) => {
    if (err) {
      return console.log(err)
    }
    console.log('Writing to ' + fileName)
  }
)
