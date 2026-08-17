/**
 * Evaluates a simple arithmetic expression (+, -, *, /, parentheses, decimals) typed by the
 * user into an amount field, e.g. "80+20*2". Returns null if the expression is empty, malformed,
 * or doesn't evaluate to a finite number — callers should leave the raw text untouched in that case.
 */
export function evaluateExpression(expression: string): number | null {
  const text = expression.trim();
  if (text === '') return null;

  let pos = 0;

  function peek(): string | undefined {
    return text[pos];
  }

  function parseExpression(): number | null {
    let value = parseTerm();
    if (value == null) return null;
    for (;;) {
      const op = peek();
      if (op !== '+' && op !== '-') break;
      pos += 1;
      const rhs = parseTerm();
      if (rhs == null) return null;
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number | null {
    let value = parseFactor();
    if (value == null) return null;
    for (;;) {
      const op = peek();
      if (op !== '*' && op !== '/') break;
      pos += 1;
      const rhs = parseFactor();
      if (rhs == null) return null;
      if (op === '/' && rhs === 0) return null;
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor(): number | null {
    if (peek() === '-') {
      pos += 1;
      const value = parseFactor();
      return value == null ? null : -value;
    }
    if (peek() === '(') {
      pos += 1;
      const value = parseExpression();
      if (value == null || peek() !== ')') return null;
      pos += 1;
      return value;
    }
    const start = pos;
    while (peek() !== undefined && /[0-9.]/.test(peek()!)) pos += 1;
    if (pos === start) return null;
    const numberText = text.slice(start, pos);
    if (!/^\d+(\.\d+)?$/.test(numberText)) return null;
    return Number(numberText);
  }

  const result = parseExpression();
  if (result == null || pos !== text.length || !Number.isFinite(result)) return null;
  return result;
}

/** True if the text contains an operator, i.e. it's a calculator expression rather than a plain number. */
export function isExpression(text: string): boolean {
  return /[+\-*/]/.test(text.trim().replace(/^-/, ''));
}
