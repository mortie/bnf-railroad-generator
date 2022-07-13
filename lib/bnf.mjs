export class StringReader {
	constructor(str) {
		this.str = str;
		this.index = 0;
		this.lineStart = false;
		this.line = 1;
		this.col = 1;
	}

	peek() {
		if (this.lineStart) {
			return 'LINE';
		}

		if (this.index >= this.str.length) {
			return null;
		} else {
			return this.str[this.index];
		}
	}

	consume() {
		if (this.lineStart) {
			this.lineStart = false;
		} else {
			this.increment();
		}
	}

	increment() {
		let ch = this.str[this.index];
		this.index += 1;
		if (ch == '\n') {
			this.col = 1;
			this.line += 1;
		} else {
			this.col += 1;
		}
	}

	skipSpace() {
		if (this.lineStart) {
			return;
		}

		while (true) {
			let ch = this.str[this.index];
			if (ch == '\n' || ch == '\r') {
				this.lineStart = true;
			} else if (ch == ' ' || ch == '\t') {
				this.lineStart = false;
			} else {
				break;
			}

			this.increment();
		}
	}

	skip(str) {
		for (let ch of str) {
			if (this.peek() != ch) {
				this.error("Expected '" + str + "'");
			}
			this.consume();
		}
	}

	error(err) {
		throw new Error(err + " -- at " + this.line + ":" + this.col);
	}
}

function readIdent(r) {
	let str = "";
	while (true) {
		let ch = r.peek();
		if (ch == null || !/^[a-zA-Z0-9\-_]$/.test(ch)) {
			if (str.length == 0) {
				r.error("Zero-length identifier before '" + ch + "'");
			}
			return str;
		}

		str += ch;
		r.consume();
	}
}

function readString(r, end) {
	let str = "";
	while (true) {
		let ch = r.peek();
		if (ch == null) {
			r.error("Unexpected EOF");
		}

		if (ch == end) {
			r.consume();
			return str;
		} else if (ch == '\\') {
			r.consume();
			ch = r.peek();
			if (ch == null) {
				r.error("Unexpected EOF");
			}

			if (ch == 'n') {
				str += '\n';
			} else if (ch == 'r') {
				str += '\r';
			} else if (ch == end || ch == '\\') {
				str += ch;
			} else {
				str += "\\";
				str += ch;
			}

			r.consume();
		} else {
			str += ch;
			r.consume();
		}
	}
}

function parseExpressionPart(r) {
	let ch = r.peek();
	let expr;
	if (ch == '(') {
		r.consume();
		expr = parseExpression(r);
		r.skipSpace();
		r.skip(')');
	} else if (ch == '"') {
		r.consume();
		expr = {terminal: readString(r, '"')};
	} else if (ch == "'") {
		r.consume();
		expr = {terminal: readString(r, "'")};
	} else if (ch == '[') {
		r.consume();
		expr = {special: readString(r, "]")};
	} else {
		expr = {ref: readIdent(r)};
	}

	while (true) {
		r.skipSpace();
		ch = r.peek();
		if (ch == '*') {
			r.consume();
			expr = {repeat0: expr};
		} else if (ch == '+') {
			r.consume();
			expr = {repeat1: expr};
		} else if (ch == '?') {
			r.consume();
			expr = {optional: expr};
		} else {
			return expr;
		}
	}
}

function parseExpressionSequence(r) {
	let parts = [];
	while (true) {
		r.skipSpace();
		let ch = r.peek();
		if (ch == 'LINE' || ch == null || ch == ')' || ch == '|') {
			break;
		}

		parts.push(parseExpressionPart(r));
	}

	if (parts.length == 1) {
		return parts[0];
	} else if (parts.length == 0) {
		return {};
	} else {
		return {seq: parts};
	}
}

function parseExpression(r) {
	let parts = [];
	while (true) {
		r.skipSpace();
		let ch = r.peek();
		if (ch == 'LINE' || ch == null || ch == ')' || ch == '|') {
			break;
		} else {
			parts.push(parseExpressionSequence(r));
		}

		r.skipSpace();
		if (r.peek() == '|') {
			r.consume();
		}
	}

	if (parts.length == 1) {
		return parts[0];
	} else if (parts.length == 0) {
		return {};
	} else {
		return {any: parts};
	}
}

function parseDecl(r) {
	let name = readIdent(r);
	r.skipSpace();
	r.skip("::=");
	r.skipSpace();
	let expr = parseExpression(r);
	if (r.peek() == 'LINE') {
		r.consume();
	}
	return [name, expr];
}

export function parseBnf(r) {
	let decls = {};
	while (true) {
		r.skipSpace();
		if (r.peek() == null) {
			break;
		}

		let [name, expr] = parseDecl(r);
		decls[name] = expr;
	}

	return decls;
}
