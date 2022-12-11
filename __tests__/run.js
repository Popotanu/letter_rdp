// Main test runner

const { Parser } = require("../src/parser");

const parser = new Parser();

const programNum = `  42  `;
const programStr = `"tanu12"`;
const programStr2 = `'tanu12'`;

const astNum = parser.parse(programNum);
const astStr = parser.parse(programStr);
const astStr2 = parser.parse(programStr2);

console.log(JSON.stringify(astNum, null, 2));
console.log(JSON.stringify(astStr, null, 2));
console.log(JSON.stringify(astStr2, null, 2));
