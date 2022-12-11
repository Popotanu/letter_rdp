// Main test runner

const { Parser } = require("../src/parser");

const parser = new Parser();

// const programNum = `42`;
const programStr = `"tanu"`;

// const astNum = parser.parse(programNum);
const astStr = parser.parse(programStr);

// console.log(JSON.stringify(astNum, null, 2));
console.log(JSON.stringify(astStr, null, 2));
