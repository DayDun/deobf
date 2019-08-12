const esprima = require("esprima");

window.esprima = esprima;

const { deobf, beautify } = require("./deobf");

let input;
let output;

window.addEventListener("load", function() {
	input = ace.edit("input");
	output = ace.edit("output");
	input.setTheme("ace/theme/xcode");
	output.setTheme("ace/theme/xcode");
	input.session.setMode("ace/mode/javascript");
	output.session.setMode("ace/mode/javascript");
	input.getSession().setUseWrapMode(true);
	output.getSession().setUseWrapMode(true);
	
	document.getElementById("beautify").addEventListener("click", function() {
		input.setValue(beautify(input.getValue(), true), -1);
	});
	document.getElementById("deobf").addEventListener("click", function() {
		output.setValue(deobf(input.getValue(), true), -1);
	});
});
