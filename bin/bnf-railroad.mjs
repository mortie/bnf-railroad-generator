#!/usr/bin/env node

import {parseBnf, StringReader} from '../lib/bnf.mjs';
import rr from 'railroad-diagrams';
import * as fs from 'fs';

function createRailroad(node) {
	if (node.seq) {
		return new rr.Sequence(node.seq.map(createRailroad));
	} else if (node.any) {
		return new rr.Choice(0, node.any.map(createRailroad));
	} else if (node.terminal) {
		return new rr.Terminal(node.terminal);
	} else if (node.ref) {
		return new rr.NonTerminal(node.ref);
	} else if (node.special) {
		return new rr.NonTerminal("[" + node.special + "]");
	} else if (node.optional) {
		return new rr.Optional(createRailroad(node.optional));
	} else if (node.repeat0) {
		return new rr.ZeroOrMore(createRailroad(node.repeat0));
	} else if (node.repeat1) {
		return new rr.OneOrMore(createRailroad(node.repeat1));
	} else {
		console.warn("Bad node:", node);
		return new rr.Terminal("");
	}
}

let argv = process.argv.slice(2);
if (argv.length != 2) {
	console.log("Usage: bnf-railroad <infile> <outfile>");
	process.exit(1);
}

let text = fs.readFileSync(argv[0], "utf-8");
let outfile = fs.createWriteStream(argv[1]);
let r = new StringReader(text);
let grammar = parseBnf(r);

function sanitizeHtml(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

outfile.write(`<!DOCTYPE html>
<html>
<body>
<style>
h2 {
    margin-bottom: 0px;
}
code pre {
    margin-top: 10px;
}
svg.railroad-diagram path {
    stroke-width: 3;
    stroke: black;
    fill: rgba(0,0,0,0);
}
svg.railroad-diagram text {
    font: bold 14px monospace;
    text-anchor: middle;
    white-space: pre;
}
svg.railroad-diagram text.diagram-text {
    font-size: 12px;
}
svg.railroad-diagram text.diagram-arrow {
    font-size: 16px;
}
svg.railroad-diagram text.label {
    text-anchor: start;
}
svg.railroad-diagram text.comment {
    font: italic 12px monospace;
}
svg.railroad-diagram g.non-terminal text {
    /*font-style: italic;*/
}
svg.railroad-diagram rect {
    stroke-width: 3;
    stroke: black;
    fill: hsl(120,100%,90%);
}
svg.railroad-diagram rect.group-box {
    stroke: gray;
    stroke-dasharray: 10 5;
    fill: none;
}
svg.railroad-diagram path.diagram-text {
    stroke-width: 3;
    stroke: black;
    fill: white;
    cursor: help;
}
svg.railroad-diagram g.diagram-text:hover path.diagram-text {
    fill: #eee;
}
</style>\n`);
for (let key of Object.keys(grammar)) {
	outfile.write(`<div>\n<h2>${sanitizeHtml(key)}</h2>\n`);
	outfile.write(new rr.Diagram([createRailroad(grammar[key])]).toString());
	outfile.write("\n</div>\n");
}
outfile.write(`<div>\n<h2>BNF:</h2>\n<code><pre>${sanitizeHtml(text)}</pre></code>\n</div>\n`);
outfile.write("</body>\n</html>\n");
outfile.close();
