module.exports = (test) => {
  test("x > 0;", {
    type: "Program",
    body: [
      {
        type: "ExpressionStatement",
        expression: {
          type: "BinaryExpression",
          operator: ">",
          left: {
            type: "Identifier",
            name: "x",
          },
          right: {
            type: "NumericLiteral",
            value: 0,
          },
        },
      },
    ],
  });

  test(`x + 5 > 10;`, {
    type: "Program",
    body: [
      {
        type: "ExpressionStatement",
        expression: {
          type: "BinaryExpression",
          operator: ">",
          left: {
            type: "BinaryExpression",
            operator: "+",
            left: {
              type: "Identifier",
              name: "x",
            },
            right: {
              type: "NumericLiteral",
              value: 5,
            },
          },
          right: {
            type: "NumericLiteral",
            value: 10,
          },
        },
      },
    ],
  });

  // 1: +
  // 2: >
  // 3: =
  test(`let y = x + 5 > 10;`, {
    type: "Program",
    body: [
      {
        type: "VariableStatement",
        declarations: [
          {
            type: "VariableDeclaration",
            id: {
              type: "Identifier",
              name: "y",
            },
            init: {
              type: "BinaryExpression",
              operator: ">",
              left: {
                type: "BinaryExpression",
                operator: "+",
                left: {
                  type: "Identifier",
                  name: "x",
                },
                right: {
                  type: "NumericLiteral",
                  value: 5,
                },
              },
              right: {
                type: "NumericLiteral",
                value: 10,
              },
            },
          },
        ],
      },
    ],
  });
};
