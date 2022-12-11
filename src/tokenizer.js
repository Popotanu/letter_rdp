// Tokenizer spec
// mapping a rule and a type
const Spec = [
  [/^\d+/, "NUMBER"],
  [/^"[^"]*"/, "STRING"],
  [/^\'[^\']*\'/, "STRING"],
];

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

    for (const [regexp, tokenType] of Spec) {
      const tokenValue = this._match(regexp, string);

      // couldnt match this rule, continue.
      if (tokenValue == null) {
        continue;
      }

      return {
        type: tokenType,
        value: tokenValue,
      };
    }

    throw new SyntaxError(`Unexpected token: "${string[0]}"`);
  }

  _match(regexp, string) {
    const matched = regexp.exec(string);
    if (matched == null) {
      return null;
    }

    this._cursor += matched[0].length;
    return matched[0];
  }
}

module.exports = {
  Tokenizer,
};
