/*
 * Letter parser: recursive descent implementations.
 * 再帰降下パーサ
 */

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
  //  : NumericLiteral
  //  ;
  Program() {
    return {
      type: "Program",
      body: this.Literal(),
    };
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
