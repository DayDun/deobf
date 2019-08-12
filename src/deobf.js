/*

[].filter + [] gives different results depending on browser

*/



const esprima = require("esprima");
const escope = require("escope");
const escodegen = require("escodegen");

const util = require("./util");
const Value = util.Value;

const {
	StringArrayRotateFunction,
	StringArrayCallsWrapper,
	SingleCallTemplate,
	SelfDefendingTemplate
} = require("./templates");

const simplify = require("./simplify");

let regIdentifier = /^([a-zA-Z_$][a-zA-Z0-9_$]*)$/;
let hexIdentifier = /_0x[0-9a-f]+/;
let asciiIdentifier = /[a-zA-Z0-9_$]/;
let controlFlowString = /^[0-9]+(?:\|[0-9]+)+$/;

function resolveStringArray(program, scopeManager) {
	let index = 0;
	
	let stringArray = [];
	let stringArrayName;
	if (util.match(program.body[index], {
		type: esprima.Syntax.VariableDeclaration,
		declarations: [
			{
				type: esprima.Syntax.VariableDeclarator,
				init: {
					type: "Value",
					valueType: "array",
					known: true
				}
			}
		]
	})) {
		stringArrayName = program.body[index].declarations[0].id.name;
		
		let array = program.body[index].declarations[0].init.getValue();
		for (let i=0; i<array.length; i++) {
			if (typeof array[i] == "string") {
				stringArray.push(array[i]);
			} else {
				return program;
			}
		}
		
		
	} else {
		return program;
	}
	
	index++;
	
	// Rotate string array
	if (
		util.matchString(program.body[index], StringArrayRotateFunction(stringArrayName, false)) ||
		util.matchString(program.body[index], StringArrayRotateFunction(stringArrayName, true))
	) {
		//console.log("rotate");
		let rotation = program.body[index].expression.arguments[1].value + 1;
		
		while (--rotation) {
			stringArray.push(stringArray.shift());
		}
		
		index++;
	} else {
		//console.log("no rotate");
	}
	
	let encoding = "unknown";
	
	if (util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName))) {
		encoding = "none";
	} else if (
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "base64", false, false)) ||
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "base64", false, true)) ||
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "base64", true, false)) ||
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "base64", true, true))
	) {
		encoding = "base64";
	} else if (
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "rc4", false, false)) ||
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "rc4", false, true)) ||
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "rc4", true, false)) ||
		util.matchString(program.body[index], StringArrayCallsWrapper(stringArrayName, "rc4", true, true))
	) {
		encoding = "rc4";
	} else {
		return program;
	}
	
	let strFuncName = program.body[index].declarations[0].id.name;
	
	program.body.splice(0, ++index);
	
	let scope;
	scopeManager.attach();
	program = util.traverse(program, {
		enter: function(node) {
			scope = scopeManager.acquire(node) || scope;
			return node;
		},
		leave: function(node, parent) {
			switch(node.type) {
				case esprima.Syntax.CallExpression:
					if (node.callee.name == strFuncName) {
						let value = stringArray[parseInt(node.arguments[0].getValue(), 16)];
						switch(encoding) {
							case "base64":
								value = Buffer.from(value, "base64").toString("binary");
								break;
							case "rc4":
								value = Buffer.from(value, "base64").toString("binary");
								let x = "";
								for (let i=0; i<value.length; i++) {
									x += "%" + ("00" + value.charCodeAt(i).toString(16)).slice(-2);
								}
								value = decodeURIComponent(x);
								value = util.rc4(value, node.arguments[1].getValue());
								break;
						}
						node = Value.from(value);
					}
					break;
			}
			scope = scopeManager.release(node) || scope;
			
			return node;
		}
	});
	scopeManager.detach();
	
	return program;
}

function resolveSelfDefence(program) {
	program = util.traverse(program, {
		enter: function(node) {
			if (node.type == esprima.Syntax.BlockStatement || node.type == esprima.Syntax.Program) {
				if (
					util.matchString(node.body[0], SingleCallTemplate()) &&
					util.matchString(node.body[1], SelfDefendingTemplate(node.body[0].declarations[0].id.name)) &&
					util.matchString(node.body[2], `${node.body[1].declarations[0].id.name}()`)
				) {
					node.body = node.body.slice(3);
					
					// Prefferably break
				}
			}
			
			return node;
		}
	});
	
	return program;
}

function resolveControlFlowFlattening(program) {
	return program;
}

function deobf(input, debug) {
	let program = esprima.parse(input, {
		range: true
	});
	let scopeManager = escope.analyze(program);
	if (debug) {
		console.log(program);
	}
	
	program = simplify(program);
	
	program = resolveStringArray(program, scopeManager);
	
	program = resolveSelfDefence(program);
	
	// Apply rules
	program = simplify(program);
	
	// Reverse control flow flattening
	program = resolveControlFlowFlattening(program);
	/*program = traverse(program, function(node) {
		return node;
	});*/
	
	
	
	program = util.traverse(program, {
		enter: function(node, parent) {
			if (node.type === "Value") {
				node = node.getEsprimaNode();
			}
			
			return node;
		}
	});
	
	// Rename variables for easier comprehension
	
	let identifiers = {};
	
	let reserved = [
		"byte", "case", "char", "do", "else", "enum", "eval", "for", "goto",
		"if", "in", "int", "let", "long", "new", "null", "this", "true", "try",
		"var", "void", "with"
	];
	
	let num = 0;
	
	program = util.traverse(program, {
		leave: function(node, parent) {
			if (node.type !== esprima.Syntax.Identifier) return node;
			
			if (parent.type == esprima.Syntax.MemberExpression && parent.property == node && parent.computed == false) {
				return node;
			}
			
			if (hexIdentifier.test(node.name) || !asciiIdentifier.test(node.name)) {
				if (!(node.name in identifiers)) {
					let id;
					
					do {
						id = util.mangledNameGenerator(num++);
					} while(reserved.includes(id) || id in identifiers);
					
					identifiers[node.name] = id;
				}
				
				node.name = identifiers[node.name];
			} else {
				identifiers[node.name] = node.name;
			}
			
			return node;
		}
	});
	
	// Done
	
	return escodegen.generate(program, {
		format: {
			quotes: "double",
			indent: {
				style: "\t"
			}
		}
	});
}

function beautify(input) {
	let program = esprima.parse(input, {
		range: true
	});
	
	return escodegen.generate(program, {
		format: {
			quotes: "double",
			indent: {
				style: "\t"
			}
		}
	});
}

module.exports = {
	deobf,
	beautify
};
