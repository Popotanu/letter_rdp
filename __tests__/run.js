// Main test runner

const { Parser } = require("../src/parser");
const assert = require("assert");
const jsonDiff = require("json-diff");

/*
 * List of tests
 */

const tests = [
  require("./literals-test.js"),
  require("./block-test.js"),
  require("./empty-statement"),
  require("./math-test.js"),
  require("./assignment-test.js"),
  require("./variable-test.js"),
  require("./if-test.js"),
  require("./relational-test"),
  require("./equality-test"),
  require("./logical-test"),
  require("./unary-test"),
  require("./while-test"),
  require("./do-while-test"),
  require("./for-test"),
  require("./function-declaration-test"),
  require("./member-test"),
  require("./call-test"),
  require("./class-teset"),
];

const parser = new Parser();

/*
 * for manual tests.
 */

function exec() {
  const program = `

  /*
  * tanu
  */
  "tanutanu";

  // Number:
  let x = 42;

  if(x) {if (y) {} else {}
  }else{};

  let y = x + 5 > 10;
  
  console.log(tanu = 2);
  tanu()();

  `;

  const ast = parser.parse(program);
  console.log(JSON.stringify(ast, null, 2));
}

/*
 * test function
 */

function test(program, expected) {
  const ast = parser.parse(program);

  try {
    assert.deepEqual(ast, expected);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      console.error("AssertionError:", error.message);
      console.error(jsonDiff.diffString(ast, expected));
      throw error;
    } else {
      throw error;
    }
  }
}

exec();
// run all tests:

tests.forEach((testRun) => testRun(test));

console.log("all assertions passed!");
