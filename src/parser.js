/*
 * Letter parser: recursive descent implementations.
 * 再帰降下パーサ
 */

class Parser {
  /*
   * parses a string into an AST.
   */

  parse(string) {
    this._string = string;

    // parse recursively starting from the main
    // entry point, the Program:

    return this.Program();
  }

  // main entry point
  // Program
  //  : NumericLiteral
  //  ;
  Program() {
    return this.NumericLiteral();
  }

  // NumericLiteral
  //  : NUMBER
  //  ;
  NumericLiteral() {
    return {
      type: "NumericLiteral",
      value: Number(this._string),
    };
  }
  //
}

module.exports = {
  Parser,
};
