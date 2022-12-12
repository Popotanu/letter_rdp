module.exports = (test) => {
  // Addition:
  // left: 1
  // right: 2
  test(`1 + 2;`, {
    type: "Program",
    body: [
      {
        type: "ExpressionStatement",
        expression: {
          type: "BinaryExpression",
          operator: "+",
          left: {
            type: "NumericLiteral",
            value: 1,
          },
          right: {
            type: "NumericLiteral",
            value: 2,
          },
        },
      },
    ],
  });

  // Nested binary expressions:
  // left: 3 + 2
  // right: 2
  test(`3 + 2 - 2;`, {
    type: "Program",
    body: [
      {
        type: "ExpressionStatement",
        expression: {
          type: "BinaryExpression",
          operator: "-",
          left: {
            type: "BinaryExpression",
            operator: "+",
            left: {
              type: "NumericLiteral",
              value: 3,
            },
            right: {
              type: "NumericLiteral",
              value: 2,
            },
          },
          right: {
            type: "NumericLiteral",
            value: 2,
          },
        },
      },
    ],
  });
};
