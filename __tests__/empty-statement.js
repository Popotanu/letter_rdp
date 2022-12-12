const { default: test } = require("node:test");

module.exports = (test) => {
  test(";", {
    type: "Program",
    body: [
      {
        type: "EmptyStatement",
      },
    ],
  });
};
