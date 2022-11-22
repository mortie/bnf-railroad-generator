#!/usr/bin/env node

import {parseBnf, StringReader} from '../lib/bnf.mjs';
import rr from 'railroad-diagrams';
import * as fs from 'fs';

rr.Diagram.INTERNAL_ALIGNMENT = "left";

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
	} else if (node.comment) {
		return new rr.Comment(node.comment);
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

let svgcss = `
<style>
path {
	stroke-width: 3;
	stroke: black;
	fill: rgba(0,0,0,0);
}
text {
	font: bold 13px monospace;
	text-anchor: middle;
	white-space: pre;
}
text.diagram-text {
	font-size: 12px;
}
text.diagram-arrow {
	font-size: 16px;
}
text.label {
	text-anchor: start;
}
text.comment {
	font: italic 12px monospace;
}
g.non-terminal text {
	/*font-style: italic;*/
}
rect {
	stroke-width: 3;
	stroke: black;
	fill: hsl(120,100%,90%);
}
rect.group-box {
	stroke: gray;
	stroke-dasharray: 10 5;
	fill: none;
}
path.diagram-text {
	stroke-width: 3;
	stroke: black;
	fill: white;
	cursor: help;
}
path.diagram-text {
	fill: #eee;
}
</style>`;

outfile.write(`<!DOCTYPE html>
<html>
<body>
<style>
#container {
	display: inline-block;
}
h2 {
	margin-top: 0px;
	margin-bottom: -10px;
	font-family: Sans-Serif;
	font-size: 24px;
}
code pre {
	margin-top: 10px;
}
</style>
<script>
function svgToImg(svg, cb) {
	var img = document.createElement("img");
	var xml = new XMLSerializer().serializeToString(svg);
	img.src = "data:image/svg+xml;base64," + btoa(xml);
	img.onload = function() { cb(img); };
}

function pageToCanvas(cb) {
	var diagrams = document.querySelectorAll(".diagram");
	var width = 0;
	var height = 0;
	for (var i = 0; i < diagrams.length; ++i) {
		var diag = diagrams[i];
		if (diag.offsetWidth > width) {
			width = diag.offsetWidth;
		}
		height += diag.offsetHeight;
	}
	width += 16;
	height += 16;

	var canvas = document.createElement("canvas");
	canvas.width = width * 2;
	canvas.height = height * 2;
	var ctx = canvas.getContext("2d");
	ctx.scale(2, 2);

	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, width, height);

	var left = diagrams.length;

	ctx.fillStyle = "black";
	ctx.textBaseline = "top";
	ctx.font = "bold 24px Sans-Serif";
	var y = 8;
	for (var i = 0; i < diagrams.length; ++i) {
		var diag = diagrams[i];
		var title = diag.querySelector("h2").innerText;
		svgToImg(diag.querySelector("svg"), function(y, title, img) {
			ctx.fillText(title, 8, y);
			ctx.drawImage(img, 8, y + 15);
			left -= 1;
			if (left == 0) {
				cb(canvas);
			}
		}.bind(null, y, title));
		y += diag.offsetHeight;
	}
}

function saveImage() {
	pageToCanvas(function(canvas) {
		location.href = canvas.toDataURL("image/png");
	});
}
</script>
<button style="float: right" onclick="saveImage()">Export to PNG</button>
`);
outfile.write(`<div id="container">\n`);
for (let key of Object.keys(grammar)) {
	outfile.write(`<div class="diagram">\n<h2>${sanitizeHtml(key)}</h2>\n`);
	let svg = new rr.Diagram([createRailroad(grammar[key])]).toString();
	svg = svg.replace('>', '>' + svgcss);
	outfile.write(svg);
	outfile.write("\n</div>\n");
}
outfile.write("</div>");
outfile.write("</body>\n</html>\n");
outfile.close();
