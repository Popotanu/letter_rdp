// Tokenizer class
//
// Lazily pulls a token from a stream.

class Tokenizer {
  // initializes the string

  init(string) {
    this._string = string;
    this._cursor = 0;
  }

  // whether the tokenizer reached EOF.
  isEOF() {
    return this._cursor === this._string.length;
  }

  // whether we still have more tokens.
  hasMoreTokens() {
    return this._cursor < this._string.length;
  }

  // Obtains next token.
  getNextToken() {
    if (!this.hasMoreTokens()) {
      return null;
    }

    // "tanu".slice(1) => "anu";
    const string = this._string.slice(this._cursor);

    // Numbers: \d+
    // /^\d+/.exec("12345")[0] => '12345'
    let matched = /^\d+/.exec(string);
    if (matched !== null) {
      this._cursor += matched[0].length;
      while (!Number.isNaN(Number(string[this._cursor]))) {
        number += string[this._cursor++];
      }

      return {
        type: "NUMBER",
        value: matched[0],
      };
    }

    // String:
    matched = /^"[^"]*"/.exec(string);
    if (matched !== null) {
      this._cursor += matched[0].length;
      return {
        type: "STRING",
        value: matched[0],
      };
    }

    return null;
  }
}

module.exports = {
  Tokenizer,
};
