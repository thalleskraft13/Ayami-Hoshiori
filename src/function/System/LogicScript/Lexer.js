'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — LEXER (Tokenizador)
   Converte código fonte em tokens tipados.
   ═══════════════════════════════════════════ */

const TokenType = {
  // Literais
  NUMBER:     'NUMBER',
  STRING:     'STRING',
  BOOL:       'BOOL',
  NIL:        'NIL',

  // Identificadores e palavras-chave
  IDENT:      'IDENT',
  LET:        'LET',
  CONST:      'CONST',
  FUNCTION:   'FUNCTION',
  RETURN:     'RETURN',
  IF:         'IF',
  ELSE:       'ELSE',
  ELSEIF:     'ELSEIF',
  THEN:       'THEN',
  END:        'END',
  WHILE:      'WHILE',
  FOR:        'FOR',
  IN:         'IN',
  DO:         'DO',
  BREAK:      'BREAK',
  CONTINUE:   'CONTINUE',
  ON:         'ON',
  IMPORT:     'IMPORT',
  EXPORT:     'EXPORT',
  FROM:       'FROM',
  AND:        'AND',
  OR:         'OR',
  NOT:        'NOT',

  // Operadores
  PLUS:       '+',
  MINUS:      '-',
  STAR:       '*',
  SLASH:      '/',
  PERCENT:    '%',
  EQ:         '==',
  NEQ:        '!=',
  LT:         '<',
  GT:         '>',
  LTE:        '<=',
  GTE:        '>=',
  ASSIGN:     '=',
  CONCAT:     '..',
  DOT:        '.',

  // Delimitadores
  LPAREN:     '(',
  RPAREN:     ')',
  LBRACE:     '{',
  RBRACE:     '}',
  LBRACKET:   '[',
  RBRACKET:   ']',
  COMMA:      ',',
  COLON:      ':',
  SEMICOLON:  ';',
  NEWLINE:    'NEWLINE',

  EOF:        'EOF',
};

const KEYWORDS = new Map([
  ['let',      TokenType.LET],
  ['const',    TokenType.CONST],
  ['function', TokenType.FUNCTION],
  ['return',   TokenType.RETURN],
  ['if',       TokenType.IF],
  ['else',     TokenType.ELSE],
  ['elseif',   TokenType.ELSEIF],
  ['then',     TokenType.THEN],
  ['end',      TokenType.END],
  ['while',    TokenType.WHILE],
  ['for',      TokenType.FOR],
  ['in',       TokenType.IN],
  ['do',       TokenType.DO],
  ['break',    TokenType.BREAK],
  ['continue', TokenType.CONTINUE],
  ['on',       TokenType.ON],
  ['import',   TokenType.IMPORT],
  ['export',   TokenType.EXPORT],
  ['from',     TokenType.FROM],
  ['and',      TokenType.AND],
  ['or',       TokenType.OR],
  ['not',      TokenType.NOT],
  ['true',     TokenType.BOOL],
  ['false',    TokenType.BOOL],
  ['nil',      TokenType.NIL],
]);

class Token {
  constructor(type, value, line) {
    this.type  = type;
    this.value = value;
    this.line  = line;
  }
}

class LexerError extends Error {
  constructor(message, line) {
    super(`[Logic Script] Erro de sintaxe na linha ${line}: ${message}`);
    this.line = line;
  }
}

class Lexer {
  constructor(source) {
    this.source  = source;
    this.pos     = 0;
    this.line    = 1;
    this.tokens  = [];
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this._skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // Números
      if (/\d/.test(ch)) { this._readNumber(); continue; }

      // Strings
      if (ch === '"' || ch === "'") { this._readString(ch); continue; }

      // Identificadores e palavras-chave
      if (/[a-zA-Z_]/.test(ch)) { this._readIdent(); continue; }

      // Operadores e pontuação
      if (this._readOperator()) continue;

      // Quebra de linha significativa
      if (ch === '\n') {
        this.tokens.push(new Token(TokenType.NEWLINE, '\n', this.line));
        this.line++;
        this.pos++;
        continue;
      }

      throw new LexerError(`Caractere inesperado: '${ch}'`, this.line);
    }

    this.tokens.push(new Token(TokenType.EOF, null, this.line));
    return this.tokens;
  }

  _peek(offset = 0) {
    return this.source[this.pos + offset] ?? '';
  }

  _skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      // Espaço/tab
      if (ch === ' ' || ch === '\t' || ch === '\r') { this.pos++; continue; }

      // Comentário de linha: --
      if (ch === '-' && this._peek(1) === '-') {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') this.pos++;
        continue;
      }

      // Comentário de bloco: /* ... */
      if (ch === '/' && this._peek(1) === '*') {
        this.pos += 2;
        while (this.pos < this.source.length) {
          if (this.source[this.pos] === '*' && this._peek(1) === '/') {
            this.pos += 2;
            break;
          }
          if (this.source[this.pos] === '\n') this.line++;
          this.pos++;
        }
        continue;
      }

      break;
    }
  }

  _readNumber() {
    let num = '';
    while (this.pos < this.source.length && /[\d.]/.test(this.source[this.pos])) {
      num += this.source[this.pos++];
    }
    this.tokens.push(new Token(TokenType.NUMBER, parseFloat(num), this.line));
  }

  _readString(quote) {
    this.pos++; // pula o abre-aspas
    let str = '';
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === quote) { this.pos++; break; }
      if (ch === '\\') {
        this.pos++;
        const esc = this.source[this.pos++];
        const ESC = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
        str += ESC[esc] ?? esc;
      } else {
        if (ch === '\n') this.line++;
        str += ch;
        this.pos++;
      }
    }
    this.tokens.push(new Token(TokenType.STRING, str, this.line));
  }

  _readIdent() {
    let id = '';
    while (this.pos < this.source.length && /[\w]/.test(this.source[this.pos])) {
      id += this.source[this.pos++];
    }
    const kwType = KEYWORDS.get(id);
    if (kwType) {
      const val = (kwType === TokenType.BOOL) ? (id === 'true') : (kwType === TokenType.NIL ? null : id);
      this.tokens.push(new Token(kwType, val, this.line));
    } else {
      this.tokens.push(new Token(TokenType.IDENT, id, this.line));
    }
  }

  _readOperator() {
    const ch   = this.source[this.pos];
    const next = this._peek(1);

    const two = ch + next;
    const TWO_CHAR = {
      '==': TokenType.EQ,
      '!=': TokenType.NEQ,
      '<=': TokenType.LTE,
      '>=': TokenType.GTE,
      '..': TokenType.CONCAT,
    };

    if (TWO_CHAR[two]) {
      this.tokens.push(new Token(TWO_CHAR[two], two, this.line));
      this.pos += 2;
      return true;
    }

    const ONE_CHAR = {
      '+': TokenType.PLUS,
      '-': TokenType.MINUS,
      '*': TokenType.STAR,
      '/': TokenType.SLASH,
      '%': TokenType.PERCENT,
      '<': TokenType.LT,
      '>': TokenType.GT,
      '=': TokenType.ASSIGN,
      '.': TokenType.DOT,
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '{': TokenType.LBRACE,
      '}': TokenType.RBRACE,
      '[': TokenType.LBRACKET,
      ']': TokenType.RBRACKET,
      ',': TokenType.COMMA,
      ':': TokenType.COLON,
      ';': TokenType.SEMICOLON,
    };

    if (ONE_CHAR[ch] !== undefined) {
      this.tokens.push(new Token(ONE_CHAR[ch], ch, this.line));
      this.pos++;
      return true;
    }

    return false;
  }
}

module.exports = { Lexer, Token, TokenType, LexerError };
