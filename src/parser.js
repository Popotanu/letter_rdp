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
   *  : FunctionStatement
   *  : ReturnStatement
   *  : ClassStatement
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
      case "def":
        return this.FunctionDeclaration();
      case "class":
        return this.ClassDeclaration();
      case "return":
        return this.ReturnStatement();
      default:
        return this.ExpressionStatement();
    }
  }

  /*
   * ClassDeclaration
   *  : 'class' Identifier OptClassExtends    BlockStatement
   *  :  class <className> [extends <parent>] { ... }
   *  ;
   */
  ClassDeclaration() {
    this._eat("class");

    const id = this.Identifier();
    const superClass = this._lookahead.type === "extends" ? this.ClassExtends() : null;

    const body = this.BlockStatement();

    return {
      type: "ClassDeclaration",
      id,
      superClass,
      body,
    };
  }

  /*
   * ClassExtends
   *   : 'extends' Identifier
   *   ;
   */
  ClassExtends() {
    this._eat("extends");
    return this.Identifier();
  }

  /*
   * FunctionDeclaration
   *  : 'def' Identifier '{' OptFormalParameterList '}' BlockStatement
   *  |
   */
  FunctionDeclaration() {
    this._eat("def");
    const name = this.Identifier();

    this._eat("(");

    // OptFormalParameterList
    const params = this._lookahead.type !== ")" ? this.FormalParameterList() : [];
    this._eat(")");

    const body = this.BlockStatement();

    return {
      type: "FunctionDeclaration",
      name,
      params,
      body,
    };
  }

  /*
   * FormalParameterList
   *   : Identifier
   *   | FormalParameterList ',' Identifier
   *   ;
   */
  FormalParameterList() {
    const params = [];

    do {
      params.push(this.Identifier());
    } while (this._lookahead.type === "," && this._eat(","));

    return params;
  }

  /*
   * ReturnStatement
   *   : 'return' OptExpression
   *   ;
   */
  ReturnStatement() {
    this._eat("return");
    const argument = this._lookahead.type !== ";" ? this.Expression() : null;
    this._eat(";");
    return {
      type: "ReturnStatement",
      argument,
    };
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
   * WhileStatement
   *   : 'while' '(' Expression ')' Statement
   *   ;
   */
  WhileStatement() {
    this._eat("while");

    this._eat("(");
    const test = this.Expression();
    this._eat(")");

    const body = this.Statement();

    return {
      type: "WhileStatement",
      test,
      body,
    };
  }

  /*
   * DoWhileStatement
   *   : 'do' Statement 'while' '(' Expression ')' ';'
   *   ;
   */
  DoWhileStatement() {
    this._eat("do");
    const body = this.Statement();

    this._eat("while");

    this._eat("(");
    const test = this.Expression();
    this._eat(")");
    this._eat(";");

    return {
      type: "DoWhileStatement",
      body,
      test,
    };
  }

  /*
   * ForStatement
   *   : 'for' '(' OptForStatementInit ';' OptExpression ';' OptExpression ')' Statement
   *   ;
   */
  ForStatement() {
    this._eat("for");
    this._eat("(");

    const init = this._lookahead.type !== ";" ? this.ForStatementInit() : null;
    this._eat(";");

    const test = this._lookahead.type !== ";" ? this.Expression() : null;
    this._eat(";");

    const update = this._lookahead.type !== ")" ? this.Expression() : null;
    this._eat(")");

    const body = this.Statement();

    return {
      type: "ForStatement",
      init,
      test,
      update,
      body,
    };
  }

  /*
   * ForStatementInit
   *  : VariableStatementInit
   *  | Expression
   *  ;
   */
  ForStatementInit() {
    // forの条件の1つ目で変数を宣言してもいいし,任意の式を書いてもいい
    if (this._lookahead.type === "let") {
      return this.VariableStatementInit();
    }
    return this.Expression();
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
   * VariableStatementInit
   *   : 'let' VariableStatementList
   *   ;
   */
  VariableStatementInit() {
    // forの条件内の変数宣言に使いたいから';'をeatしない
    // for(let x=0 ; ;)
    //     ^^^^^^^ これ
    this._eat("let");
    const declarations = this.VariableDeclarationList();
    return {
      type: "VariableStatement",
      declarations,
    };
  }

  /*
   * VariableStatement
   *   : 'let' VariableStatementList ';'
   *   ;
   */
  VariableStatement() {
    // (forの条件内ではない)普通の変数宣言
    // ちゃんと';'の存在を確認する.eatする
    const VariableStatement = this.VariableStatementInit();
    this._eat(";");
    return VariableStatement;
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
   *  : CallMemberExpression
   *  ;
   */
  LeftHandSideExpression() {
    return this.CallMemberExpression();
  }

  /*
   * CallMemberExpression
   *   : MemberExpression
   *   | CallExpression
   *   ;
   */
  CallMemberExpression() {
    // Super call:
    if (this._lookahead.type === "super") {
      return this._CallExpression(this.Super());
    }

    // Member part, might be part of a call
    const member = this.MemberExpression();

    // See if we have a call expression:
    if (this._lookahead.type === "(") {
      return this._CallExpression(member);
    }

    // SImple member expression:
    return member;
  }

  /*
   * Generic call expression helper.
   *
   * CallExpression
   *   : Callee arguments
   *   ;
   *
   * Callee
   *   : MemberExpression
   *   | CallExpression
   *   ;
   */
  _CallExpression(callee) {
    let callExpression = {
      type: "CallExpression",
      callee,
      arguments: this.Arguments(),
    };

    // for nested chain call
    if (this._lookahead.type === "(") {
      callExpression = this._CallExpression(callExpression);
    }

    return callExpression;
  }

  /*
   * Arguments
   *   : '(' OptArgumentList ')'
   *   ;
   */
  Arguments() {
    this._eat("(");

    const argumentList = this._lookahead.type !== ")" ? this.ArgumentList() : [];

    this._eat(")");

    return argumentList;
  }

  /*
   * ArgumentList
   *   : AssignmentExpression
   *   | ArgumentList ',' AssignmentExpression
   */
  ArgumentList() {
    // foo(bar = 1, baz = 2)
    const argumentList = [];

    do {
      argumentList.push(this.AssignmentExpression());
    } while (this._lookahead.type === "," && this._eat(","));

    return argumentList;
  }

  /*
   * MemberExpression
   *   : PrimaryExpression
   *   | MemberExpression '.' Identifier
   *   | MemberExpression '[' Expression ']'
   */
  MemberExpression() {
    let object = this.PrimaryExpression();

    while (this._lookahead.type === "." || this._lookahead.type === "[") {
      // MemberExpression '.' Identifier
      if (this._lookahead.type === ".") {
        this._eat(".");
        const property = this.Identifier();
        object = {
          type: "MemberExpression",
          computed: false,
          object,
          property,
        };
      }

      // MemberExpression '[' Expression ']'
      if (this._lookahead.type === "[") {
        this._eat("[");
        // 任意の式
        // e.g.) x['z'], x[val], x[i+2]
        const property = this.Expression();
        this._eat("]");
        object = {
          type: "MemberExpression",
          computed: true,
          object,
          property,
        };
      }
    }

    return object;
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
    if (node.type === "Identifier" || node.type === "MemberExpression") {
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
   *   | AdditiveExpression ADDITIVE_OPERATOR Literal -" Literal ADDITIVE_OPERATOR Literal ADDITIVE_OPERATOR Literal
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
   *   | ThisExpression
   *   | NewExpression
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
      case "this":
        return this.ThisExpression();
      case "new":
        return this.NewExpression();
      default:
        return this.LeftHandSideExpression();
    }
  }

  /*
   * NewExpression
   *   : 'new' MemberExpression Arguments
   *   :  new  MyNameSpace.MyClass(1,2);
   *   ;
   */
  NewExpression() {
    this._eat("new");
    return {
      type: "NewExpression",
      callee: this.MemberExpression(),
      arguments: this.Arguments(),
    };
  }

  /*
   * ThisExpression
   *   ; 'this'
   *   :
   */
  ThisExpression() {
    this._eat("this");
    return {
      type: "ThisExpression",
    };
  }

  /*
   * Super
   *   : 'super'
   *   ;
   */
  Super() {
    this._eat("super");
    return {
      type: "Super",
    };
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
