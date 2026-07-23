'use strict';


const { TokenType, LexerError } = require('./Lexer.js');

class ParseError extends Error {
  constructor(message, line) {
    super(`[Logic Script] Erro de parse na linha ${line}: ${message}`);
    this.line = line;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens.filter(t => t.type !== TokenType.NEWLINE);
    this.pos    = 0;
  }

  _peek(offset = 0) { return this.tokens[this.pos + offset] ?? { type: TokenType.EOF, value: null, line: -1 }; }
  _current()        { return this._peek(0); }
  _advance()        { return this.tokens[this.pos++]; }
  _check(type)      { return this._current().type === type; }
  _match(...types)  { for (const t of types) if (this._check(t)) { this._advance(); return true; } return false; }
  _expect(type, msg) {
    if (!this._check(type)) {
      const cur = this._current();
      throw new ParseError(msg ?? `Esperado '${type}', encontrado '${cur.value ?? cur.type}'`, cur.line);
    }
    return this._advance();
  }

  parse() {
    const body = this._parseBlock();
    this._expect(TokenType.EOF);
    return { type: 'Program', body };
  }

  _parseBlock(stopAt = [TokenType.EOF]) {
    const stmts = [];
    while (!stopAt.includes(this._current().type)) {
      const s = this._parseStatement();
      if (s) stmts.push(s);
    }
    return stmts;
  }

  _parseStatement() {
    const cur = this._current();
    switch (cur.type) {
      case TokenType.LET:
      case TokenType.CONST:    return this._parseVarDecl();
      case TokenType.FUNCTION: return this._parseFunctionDecl();
      case TokenType.RETURN:   return this._parseReturn();
      case TokenType.IF:       return this._parseIf();
      case TokenType.WHILE:    return this._parseWhile();
      case TokenType.FOR:      return this._parseFor();
      case TokenType.BREAK:    this._advance(); return { type: 'Break', line: cur.line };
      case TokenType.CONTINUE: this._advance(); return { type: 'Continue', line: cur.line };
      case TokenType.ON:       return this._parseOnEvent();
      case TokenType.IMPORT:   return this._parseImport();
      case TokenType.EXPORT:   return this._parseExport();
      case TokenType.SEMICOLON: this._advance(); return null;
      default:                 return this._parseExprStatement();
    }
  }

  _parseVarDecl() {
    const kind = this._advance().type;
    const name = this._expect(TokenType.IDENT, 'Nome de variável esperado').value;
    this._expect(TokenType.ASSIGN, "'=' esperado");
    const init = this._parseExpression();
    return { type: 'VarDecl', kind, name, init };
  }

  _parseFunctionDecl(isExported = false) {
    this._advance(); 
    const name   = this._expect(TokenType.IDENT, 'Nome da função esperado').value;
    const params = this._parseParamList();
    const body   = this._parseBlock([TokenType.END]);
    this._expect(TokenType.END, "'end' esperado");
    return { type: 'FunctionDecl', name, params, body, isExported };
  }

  _parseParamList() {
    this._expect(TokenType.LPAREN, "'(' esperado");
    const params = [];
    while (!this._check(TokenType.RPAREN) && !this._check(TokenType.EOF)) {
      params.push(this._expect(TokenType.IDENT, 'Parâmetro esperado').value);
      if (!this._match(TokenType.COMMA)) break;
    }
    this._expect(TokenType.RPAREN, "')' esperado");
    return params;
  }

  _parseReturn() {
    const line = this._advance().line;
    const ends = [TokenType.END, TokenType.ELSE, TokenType.ELSEIF, TokenType.EOF];
    const val  = ends.includes(this._current().type) ? null : this._parseExpression();
    return { type: 'Return', value: val, line };
  }

  _parseIf() {
    this._advance();
    const test       = this._parseExpression();
    this._expect(TokenType.THEN, "'then' esperado");
    const consequent = this._parseBlock([TokenType.END, TokenType.ELSE, TokenType.ELSEIF]);
    const alternates = [];
    while (this._check(TokenType.ELSEIF)) {
      this._advance();
      const et   = this._parseExpression();
      this._expect(TokenType.THEN);
      const eb   = this._parseBlock([TokenType.END, TokenType.ELSE, TokenType.ELSEIF]);
      alternates.push({ test: et, body: eb });
    }
    let elseBody = null;
    if (this._match(TokenType.ELSE)) elseBody = this._parseBlock([TokenType.END]);
    this._expect(TokenType.END, "'end' esperado");
    return { type: 'If', test, consequent, alternates, elseBody };
  }

  _parseWhile() {
    this._advance();
    const test = this._parseExpression();
    this._expect(TokenType.DO, "'do' esperado");
    const body = this._parseBlock([TokenType.END]);
    this._expect(TokenType.END);
    return { type: 'While', test, body };
  }

  _parseFor() {
    this._advance();
    const varName = this._expect(TokenType.IDENT, 'Variável de iteração esperada').value;
    if (this._check(TokenType.IN)) {
      this._advance();
      const iter = this._parseExpression();
      this._expect(TokenType.DO, "'do' esperado");
      const body = this._parseBlock([TokenType.END]);
      this._expect(TokenType.END);
      return { type: 'ForIn', var: varName, iter, body };
    }
    this._expect(TokenType.ASSIGN);
    const start = this._parseExpression();
    this._expect(TokenType.COMMA);
    const limit = this._parseExpression();
    let step = null;
    if (this._match(TokenType.COMMA)) step = this._parseExpression();
    this._expect(TokenType.DO);
    const body = this._parseBlock([TokenType.END]);
    this._expect(TokenType.END);
    return { type: 'ForNum', var: varName, start, limit, step, body };
  }

  _parseOnEvent() {
    this._advance(); 
    const eventName = this._expect(TokenType.IDENT, 'Nome do evento esperado').value;

    this._expect(TokenType.LPAREN, "'(' esperado");

    let commandName = null;
    const params    = [];

    if (this._check(TokenType.STRING)) {
      commandName = this._advance().value;
      if (this._match(TokenType.COMMA)) {
        while (!this._check(TokenType.RPAREN) && !this._check(TokenType.EOF)) {
          params.push(this._expect(TokenType.IDENT, 'Parâmetro esperado').value);
          if (!this._match(TokenType.COMMA)) break;
        }
      }
    } else {
      while (!this._check(TokenType.RPAREN) && !this._check(TokenType.EOF)) {
        params.push(this._expect(TokenType.IDENT, 'Parâmetro esperado').value);
        if (!this._match(TokenType.COMMA)) break;
      }
    }

    this._expect(TokenType.RPAREN, "')' esperado");
    const body = this._parseBlock([TokenType.END]);
    this._expect(TokenType.END, "'end' esperado");
    return { type: 'OnEvent', event: eventName, commandName, params, body };
  }

  _parseImport() {
    this._advance();
    let names = null, deflt = null;
    if (this._check(TokenType.LBRACE)) {
      this._advance();
      names = [];
      while (!this._check(TokenType.RBRACE) && !this._check(TokenType.EOF)) {
        names.push(this._expect(TokenType.IDENT).value);
        if (!this._match(TokenType.COMMA)) break;
      }
      this._expect(TokenType.RBRACE);
    } else {
      deflt = this._expect(TokenType.IDENT).value;
    }
    this._expect(TokenType.FROM, "'from' esperado");
    const source = this._expect(TokenType.STRING, 'Caminho esperado').value;
    return { type: 'Import', default: deflt, names, source };
  }

  _parseExport() {
    this._advance();
    if (this._check(TokenType.FUNCTION)) return this._parseFunctionDecl(true);
    if (this._check(TokenType.LET) || this._check(TokenType.CONST)) {
      const d = this._parseVarDecl();
      d.isExported = true;
      return d;
    }
    throw new ParseError('Somente funções e variáveis podem ser exportadas', this._current().line);
  }

  _parseExprStatement() {
    const expr = this._parseExpression();
    if (this._check(TokenType.ASSIGN) && expr.type === 'Identifier') {
      this._advance();
      return { type: 'Assign', target: expr, value: this._parseExpression() };
    }
    if (this._check(TokenType.ASSIGN) && expr.type === 'MemberAccess') {
      this._advance();
      return { type: 'AssignMember', target: expr, value: this._parseExpression() };
    }
    return { type: 'ExprStmt', expr };
  }

  _parseExpression() { return this._parseOr(); }

  _parseOr() {
    let left = this._parseAnd();
    while (this._check(TokenType.OR)) { this._advance(); left = { type: 'BinOp', op: 'or', left, right: this._parseAnd() }; }
    return left;
  }

  _parseAnd() {
    let left = this._parseEquality();
    while (this._check(TokenType.AND)) { this._advance(); left = { type: 'BinOp', op: 'and', left, right: this._parseEquality() }; }
    return left;
  }

  _parseEquality() {
    let left = this._parseComparison();
    while (this._check(TokenType.EQ) || this._check(TokenType.NEQ)) {
      const op = this._advance().value;
      left = { type: 'BinOp', op, left, right: this._parseComparison() };
    }
    return left;
  }

  _parseComparison() {
    let left = this._parseConcat();
    while ([TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE].includes(this._current().type)) {
      const op = this._advance().value;
      left = { type: 'BinOp', op, left, right: this._parseConcat() };
    }
    return left;
  }

  _parseConcat() {
    let left = this._parseAddSub();
    while (this._check(TokenType.CONCAT)) { this._advance(); left = { type: 'BinOp', op: '..', left, right: this._parseAddSub() }; }
    return left;
  }

  _parseAddSub() {
    let left = this._parseMulDiv();
    while (this._check(TokenType.PLUS) || this._check(TokenType.MINUS)) {
      const op = this._advance().value;
      left = { type: 'BinOp', op, left, right: this._parseMulDiv() };
    }
    return left;
  }

  _parseMulDiv() {
    let left = this._parseUnary();
    while ([TokenType.STAR, TokenType.SLASH, TokenType.PERCENT].includes(this._current().type)) {
      const op = this._advance().value;
      left = { type: 'BinOp', op, left, right: this._parseUnary() };
    }
    return left;
  }

  _parseUnary() {
    if (this._check(TokenType.NOT)) { this._advance(); return { type: 'UnaryOp', op: 'not', operand: this._parseUnary() }; }
    if (this._check(TokenType.MINUS)) { this._advance(); return { type: 'UnaryOp', op: '-', operand: this._parseUnary() }; }

    if (this._check(TokenType.IDENT) && this._current().value === 'new') {
      this._advance(); 
      const name = this._expect(TokenType.IDENT, 'Nome da classe esperado').value;
      const args = this._parseArgList();
      return { type: 'NewExpression', name, args };
    }

    return this._parsePostfix();
  }

  _parsePostfix() {
    let expr = this._parsePrimary();
    while (true) {
      if (this._check(TokenType.DOT)) {
        this._advance();
        const prop = this._expect(TokenType.IDENT, 'Propriedade esperada').value;
        if (this._check(TokenType.LPAREN)) {
          const args = this._parseArgList();
          expr = { type: 'MethodCall', object: expr, method: prop, args };
        } else {
          expr = { type: 'MemberAccess', object: expr, prop };
        }
        continue;
      }
      if (this._check(TokenType.LBRACKET)) {
        this._advance();
        const key = this._parseExpression();
        this._expect(TokenType.RBRACKET);
        expr = { type: 'IndexAccess', object: expr, key };
        continue;
      }
      if (this._check(TokenType.LPAREN) && expr.type === 'Identifier') {
        const args = this._parseArgList();
        expr = { type: 'FunctionCall', name: expr.name, args };
        continue;
      }
      break;
    }
    return expr;
  }

  _parseArgList() {
    this._expect(TokenType.LPAREN);
    const args = [];
    while (!this._check(TokenType.RPAREN) && !this._check(TokenType.EOF)) {
      args.push(this._parseExpression());
      if (!this._match(TokenType.COMMA)) break;
    }
    this._expect(TokenType.RPAREN);
    return args;
  }

  _parsePrimary() {
    const cur = this._current();
    switch (cur.type) {
      case TokenType.NUMBER:   this._advance(); return { type: 'Literal', value: cur.value, kind: 'number' };
      case TokenType.STRING:   this._advance(); return { type: 'Literal', value: cur.value, kind: 'string' };
      case TokenType.BOOL:     this._advance(); return { type: 'Literal', value: cur.value, kind: 'bool' };
      case TokenType.NIL:      this._advance(); return { type: 'Literal', value: null, kind: 'nil' };
      case TokenType.IDENT:    this._advance(); return { type: 'Identifier', name: cur.value };
      case TokenType.LPAREN: {
        this._advance();
        const expr = this._parseExpression();
        this._expect(TokenType.RPAREN);
        return expr;
      }
      case TokenType.LBRACE:   return this._parseObject();
      case TokenType.LBRACKET: return this._parseArray();
      case TokenType.FUNCTION: {
        this._advance();
        const params = this._parseParamList();
        const body   = this._parseBlock([TokenType.END]);
        this._expect(TokenType.END);
        return { type: 'FunctionExpr', params, body };
      }
      default:
        throw new ParseError(`Expressão inesperada: '${cur.value ?? cur.type}'`, cur.line);
    }
  }

  _parseObject() {
    this._expect(TokenType.LBRACE);
    const props = [];
    while (!this._check(TokenType.RBRACE) && !this._check(TokenType.EOF)) {
      let key;
      if (this._check(TokenType.LBRACKET)) {
        this._advance(); key = this._parseExpression(); this._expect(TokenType.RBRACKET);
      } else {
        const k = this._current(); this._advance();
        key = { type: 'Literal', value: k.value, kind: 'string' };
      }
      this._expect(TokenType.COLON);
      const val = this._parseExpression();
      props.push({ key, value: val });
      if (!this._match(TokenType.COMMA)) break;
    }
    this._expect(TokenType.RBRACE);
    return { type: 'ObjectLiteral', props };
  }

  _parseArray() {
    this._expect(TokenType.LBRACKET);
    const elements = [];
    while (!this._check(TokenType.RBRACKET) && !this._check(TokenType.EOF)) {
      elements.push(this._parseExpression());
      if (!this._match(TokenType.COMMA)) break;
    }
    this._expect(TokenType.RBRACKET);
    return { type: 'ArrayLiteral', elements };
  }
}

module.exports = { Parser, ParseError };
