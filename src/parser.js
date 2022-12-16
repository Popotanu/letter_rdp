/*
 * Letter parser: recursive descent implementations.
 * 再帰降下パーサ
 */

const { isGeneratorFunction } = require("util/types");
const { runInThisContext } = require("vm");
const { threadId } = require("worker_threads");
const { Tokenizer } = require("./tokenizer");

class Parser {
  /*
   * parses a string into an AST.
   */

  constructor() {
    this._string = "";
    this._tokenizer = new Tokenizer();
  }

  parse(string) {
    this._string = string;
    this._tokenizer.init(string);

    // tokenizerを初期化して最初のトークンを取得する
    // このトークンは予測構文解析に使われる
    this._lookahead = this._tokenizer.getNextToken();

    // parse recursively starting from the main
    // entry point, the Program:
    return this.Program();
  }

  // main entry point
  // Program
  //  : StatementList
  //  ;
  Program() {
    return {
      type: "Program",
      body: this.StatementList(),
    };
  }

  /*
   * StatementList
   *  : Statement
   *  | StatementList Statement -> Statement Statement Statement Statement
   *  ;
   * 降下再帰において,左再帰は無限ループに陥る
   * ので, 左再帰を除去しなければならない
   */
  StatementList(stopLookahead = null) {
    console.log("=======StatementList========");
    const statementList = [this.Statement()];
    while (this._lookahead != null && this._lookahead.type !== stopLookahead) {
      statementList.push(this.Statement());
    }

    console.table(statementList);

    return statementList;
  }

  /*
   * Statement
   *  : ExpressionStatement
   *  : BlockStatement
   *  : EmptyStatement
   *  : VariableStatement
   *  : IfStatement
   *  ;
   */
  Statement() {
    // 次に適用すべき規則を判定するため, トークンを先読みする(予言的構文解析)
    switch (this._lookahead.type) {
      case ";":
        return this.EmptyStatement();
      case "{":
        return this.BlockStatement();
      case "let":
        return this.VariableStatement();
      case "if":
        return this.IfStatement();
      case "while":
      case "do":
      case "for":
        return this.IterationStatement();
      default:
        return this.ExpressionStatement();
    }
  }

  /*
   * IterationStatement
   *  : WhileStatement
   *  | DoWhileStatement
   *  | ForStatement
   *  ;
   */
  IterationStatement() {
    switch (this._lookahead.type) {
      case "while":
        return this.WhileStatement();
      case "do":
        return this.DoWhileStatement();
      case "for":
        return this.ForStatement();
    }
  }

  /*
   * IfStatement
   *   : 'if' '(' Expression ')' Statement
   *   : 'if' '(' Expression ')' Statement 'else' Statement
   *   ;
   */
  IfStatement() {
    this._eat("if");

    this._eat("(");
    const test = this.Expression();
    this._eat(")");

    const consequent = this.Statement();

    const alternate =
      this._lookahead != null && this._lookahead.type === "else" ? this._eat("else") && this.Statement() : null;

    return {
      type: "IfStatement",
      test,
      consequent,
      alternate,
    };
  }

  /*
   * VariableStatement
   *   : 'let' VariableStatementList ';'
   *   ;
   */
  VariableStatement() {
    this._eat("let");
    const declarations = this.VariableDeclarationList();
    this._eat(";");
    return {
      type: "VariableStatement",
      declarations,
    };
  }

  /*
   * VariableDeclarationList
   *   : VariableDeclaration
   *   | VariableDeclarationList ',' VariableDeclaration
   */
  VariableDeclarationList() {
    // remove left recursion
    const declarations = [];
    do {
      declarations.push(this.VariableDeclaration());
    } while (this._lookahead.type === "," && this._eat(","));

    return declarations;
  }

  /*
   * VariableDeclaration
   *  : Identifier OptVariableInitializer
   *  ;
   */
  VariableDeclaration() {
    const id = this.Identifier();

    // OptVariableInitializer
    const init = this._lookahead.type !== ";" && this._lookahead.type !== "," ? this.VariableInitializer() : null;

    return {
      type: "VariableDeclaration",
      id,
      init,
    };
  }

  /*
   * VariableInitializer
   *  : Identifier OptVariableInitializer
   *  ;
   */
  VariableInitializer() {
    this._eat("SIMPLE_ASSIGN");
    return this.AssignmentExpression();
  }

  EmptyStatement() {
    this._eat(";");
    return {
      type: "EmptyStatement",
    };
  }

  /*
   * BlockStatement
   *   : '{' OptStatementList '}'
   *   ;
   */
  BlockStatement() {
    console.log("== BlockStatement====");
    this._eat("{");

    // stopLookaheadとして'}'を与える.ブロックの終わり
    const body = this._lookahead.type !== "}" ? this.StatementList("}") : [];
    this._eat("}");
    console.log(`body: ${body}`);
    return {
      type: "BlockStatement",
      body,
    };
  }

  /*
   * ExpressionStatement
   *   : Expression ';'
   *   ;
   */
  ExpressionStatement() {
    const expression = this.Expression();
    this._eat(";");
    return {
      type: "ExpressionStatement",
      expression,
    };
  }

  /*
   * Expression
   *   : Literal
   *   ;
   */
  Expression() {
    return this.AssignmentExpression();
  }

  /*
   * AssignmentExpression
   *  : EqualityExpression
   *  | LeftHandSideExpression AssignmentOperator AssignmentExpression
   *  ;
   */
  AssignmentExpression() {
    console.log("=======AssignmentExpression========");
    const left = this.LogicalOrExpression();

    // 先読みする. opが=だったらleftを返す. e.g.) x = 42
    // そうじゃなかったら先に何かしらの演算を施して,結果をleftに加える. e.g.) x = y + 42
    if (!this._isAssignmentOperator(this._lookahead.type)) {
      return left;
    }

    return {
      type: "AssignmentExpression",
      operator: this.AssignmentOperator().value,
      left: this._checkValidAssignmentTarget(left),
      // 左再帰の除去, 右から砕いていく
      right: this.AssignmentExpression(),
    };
  }

  /*
   * AssignmentOperator
   *  : SIMPLE_ASSIGN
   *  : COMPLEX_ASSIGN
   *  ;
   */
  AssignmentOperator() {
    if (this._lookahead.type == "SIMPLE_ASSIGN") {
      return this._eat("SIMPLE_ASSIGN");
    }
    return this._eat("COMPLEX_ASSIGN");
  }
  /*
   * Logical OR expression
   *
   *   x || y
   * LogicalAndExpression
   *   : EqualityExpression LOGICAL_OR LogicalOrExpression
   *   | EqualityExpression
   *   ;
   */
  LogicalOrExpression() {
    // || は && より優先順位が低い
    return this._LogicalExpression("LogicalAndExpression", "LOGICAL_OR");
  }

  /*
   * Logical AND expression
   *
   *   x && y
   * LogicalAndExpression
   *   : EqualityExpression LOGICAL_AND LogicalAndExpression
   *   | EqualityExpression
   *   ;
   */
  LogicalAndExpression() {
    return this._LogicalExpression("EqualityExpression", "LOGICAL_AND");
  }

  /*
   * RELATIONAL_OPERATOR : >, >=, <, <=
   *
   *   x > y
   *   x >= y
   *   x < y
   *   x <= y
   *
   * RelationalExpression
   *   : AdditiveExpression
   *   | AdditiveExpression RELATIONAL_OPERATOR RelationalExpression
   *   ;
   */
  RelationalExpression() {
    return this._BinaryExpression("AdditiveExpression", "RELATIONAL_OPERATOR");
  }

  /*
   * EQUALITY_OPERATOR: ==, !=
   *  : RelationalExpression EQUALITY_OPERATOR EqualityExpression
   *  | RelationalExpression
   *  ;
   */
  EqualityExpression() {
    return this._BinaryExpression("RelationalExpression", "EQUALITY_OPERATOR");
  }

  /*
   * LeftHandSideExpression
   *  : PrimaryExpression
   *  ;
   */
  LeftHandSideExpression() {
    return this.PrimaryExpression();
  }

  /*
   * Identifier
   *  : IDENTIFIER
   *  ;
   */
  Identifier() {
    const name = this._eat("IDENTIFIER").value;
    return {
      type: "Identifier",
      name,
    };
  }

  /*
   * Extra check whether it's valid assignment target.
   */
  _checkValidAssignmentTarget(node) {
    if (node.type === "Identifier") {
      return node;
    }

    throw new SyntaxError("Invalid left-hand side in assignment expression");
  }

  /*
   * Whether the token is an assignment operator
   */
  _isAssignmentOperator(tokenType) {
    return tokenType === "SIMPLE_ASSIGN" || tokenType === "COMPLEX_ASSIGN";
  }

  /*
   * AdditiveExpression
   *   : Literal
   *   | AdditiveExpression ADDITIVE_OPERATOR Literal -> Literal ADDITIVE_OPERATOR Literal ADDITIVE_OPERATOR Literal
   */
  AdditiveExpression() {
    console.log("=======ADDITIVE_OPERATOR========");
    return this._BinaryExpression("MultiplicativeExpression", "ADDITIVE_OPERATOR");
  }

  /*
   * MultiplicativeExpression
   *  : UnaryExpression
   *  | MultiplicativeExpression MULTIPLICATIVE_OPERATOR UnaryExpression
   *  ;
   */
  MultiplicativeExpression() {
    console.log("=======MULTIPLICATIVE_OPERATOR========");
    return this._BinaryExpression("UnaryExpression", "MULTIPLICATIVE_OPERATOR");
  }

  /*
   * Generic helper for LogicalExpression nodes.
   */
  _LogicalExpression(builderName, operatorToken) {
    let left = this[builderName]();

    while (this._lookahead.type == operatorToken) {
      const operator = this._eat(operatorToken).value;
      const right = this[builderName]();

      left = {
        type: "LogicalExpression",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  _BinaryExpression(builderName, operatorToken) {
    console.log("===========_BinaryExpression=================");
    let left = this[builderName]();

    while (this._lookahead.type == operatorToken) {
      const operator = this._eat(operatorToken).value;

      const right = this[builderName]();

      left = {
        type: "BinaryExpression",
        operator,
        left,
        right,
      };
    }

    console.table(left);
    return left;
  }

  /*
   * UnaryExpression
   *   : LeftHandSideExpression
   *   | ADDITIVE_OPERATOR UnaryExpression
   *   | LOGICAL_NOT UnaryExpression
   *   ;
   */
  UnaryExpression() {
    let operator;
    switch (this._lookahead.type) {
      // -xの-を識別するために二項演算子の-を再利用する
      case "ADDITIVE_OPERATOR":
        operator = this._eat("ADDITIVE_OPERATOR").value;
        break;
      case "LOGICAL_NOT":
        operator = this._eat("LOGICAL_NOT").value;
        break;
    }

    // ↑のcase条件に当てはまれば単項演算子
    if (operator != null) {
      return {
        type: "UnaryExpression",
        operator,
        // --x は -(-x)として認識する
        argument: this.UnaryExpression(),
      };
    }

    return this.LeftHandSideExpression();
  }

  /*
   * PrimaryExpression
   *   : Literal
   *   | ParenthesizedExpression
   *   | Identifier
   *   ;
   */
  PrimaryExpression() {
    console.log("========PrimaryExpression========");
    if (this._isLiteral(this._lookahead.type)) {
      return this.Literal();
    }
    switch (this._lookahead.type) {
      case "(":
        return this.ParenthesizedExpression();
      case "IDENTIFIER":
        return this.Identifier();
      default:
        return this.LeftHandSideExpression();
    }
  }

  /*
   * PrimaryExpression
   *   : Literal
   *   | ParenthesizedExpression
   *   | Identifier
   *   ;
   */
  PrimaryExpression() {
    console.log("========PrimaryExpression========");
    if (this._isLiteral(this._lookahead.type)) {
      return this.Literal();
    }
    switch (this._lookahead.type) {
      case "(":
        return this.ParenthesizedExpression();
      case "IDENTIFIER":
        return this.Identifier();
      default:
        return this.LeftHandSideExpression();
    }
  }

  /*
   * Whether the token is a literal.
   */
  _isLiteral(tokenType) {
    return (
      tokenType === "NUMBER" ||
      tokenType === "STRING" ||
      tokenType == "true" ||
      tokenType == "false" ||
      tokenType == "null"
    );
  }

  /*
   * ParenthesizedExpression
   *   : '(' Expression ')'
   *   ;
   */
  ParenthesizedExpression() {
    console.log("=========ParenthesizedExpression=======");
    this._eat("(");
    const expression = this.Expression();
    this._eat(")");
    // ()自体はASTを構成しない.カッコの対応だけチェックする
    return expression;
  }

  // Literal
  //    : NumericLiteral
  //    | StringLiteral
  //    ;
  Literal() {
    switch (this._lookahead.type) {
      case "NUMBER":
        return this.NumericLiteral();
      case "STRING":
        return this.StringLiteral();
      case "true":
        return this.BooleanLiteral(true);
      case "false":
        return this.BooleanLiteral(false);
      case "null":
        return this.NullLiteral();
      default:
        throw new SyntaxError(`Literal: unexpected literal production`);
    }
  }

  /*
   * BooleanLiteral
   *   : "true"
   *   | "false"
   *   ;
   */
  BooleanLiteral(value) {
    this._eat(value ? "true" : "false");
    return {
      type: "BooleanLiteral",
      value,
    };
  }

  /*
   * NullLiteral
   *   : "null"
   *   ;
   */
  NullLiteral(value) {
    this._eat("null");
    return {
      type: "NullLiteral",
      value,
    };
  }

  // NumericLiteral
  //  : String
  //  ;
  StringLiteral() {
    const token = this._eat("STRING");
    return {
      type: "StringLiteral",
      value: token.value.slice(1, -1),
    };
  }

  // NumericLiteral
  //  : NUMBER
  //  ;
  NumericLiteral() {
    const token = this._eat("NUMBER");
    return {
      type: "NumericLiteral",
      value: Number(token.value),
    };
  }

  // expects a token of a given type
  // if token is expected, advance to next token.
  // or not, raises an error.
  _eat(tokenType) {
    const token = this._lookahead;

    console.log("=======  _eat  ========= ");
    console.log(token);
    if (token == null) {
      throw new SyntaxError(`Unexpected end of input, expected: "${tokenType}"`);
    }

    if (token.type !== tokenType) {
      throw new SyntaxError(`Unexpected token: "${token.value}", expected: "${tokenType}`);
    }
    // advance to next token.
    this._lookahead = this._tokenizer.getNextToken();
    return token;
  }
}

module.exports = {
  Parser,
};
