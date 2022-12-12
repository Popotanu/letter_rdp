/*
 * Letter parser: recursive descent implementations.
 * 再帰降下パーサ
 */

const { runInThisContext } = require("vm");
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
  StatementList() {
    const statementList = [this.Statement()];
    while (this._lookahead != null) {
      statementList.push(this.Statement());
    }

    return statementList;
  }

  /*
   * Statement
   *  : ExpressionStatement
     ;
   */
  Statement() {
    return this.ExpressionStatement();
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
    return this.Literal();
  }

  // Literal
  //    : NumericLiteral
  //    | StringLiteral
  //    ;
  Literal() {
    // TODO: 次のリテラルがなにか判定する
    switch (this._lookahead.type) {
      case "NUMBER":
        return this.NumericLiteral();
      case "STRING":
        return this.StringLiteral();
      default:
        throw new SyntaxError(`Literal: unexpected literal production`);
    }
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
  _eat(tokenType) {
    const token = this._lookahead;

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
