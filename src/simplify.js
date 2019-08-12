const esprima = require("esprima");
const escope = require("escope");

const util = require("./util");

let regIdentifier = /^([a-zA-Z_$][a-zA-Z0-9_$]*)$/;
let hexIdentifier = /_0x[0-9a-f]+/;
let controlFlowString = /^[0-9]+(?:\|[0-9]+)+$/;

let rules = [
	// Resolve literals (and arrays, objects) to custom node type
	function(node) {
		if (
			node.type == esprima.Syntax.Literal ||
			node.type == esprima.Syntax.ArrayExpression ||
			node.type == esprima.Syntax.ObjectExpression
		) {
			node = new util.Value(node);
		} else if (node.type == esprima.Syntax.Identifier) {
			switch(node.name) {
				case "Infinity":
					node = util.Value.from(Infinity);
					break;
				case "NaN":
					node = util.Value.from(NaN);
					break;
				case "undefined":
					node = util.Value.from(undefined);
					break;
			}
		}
		
		return node;
	},
	// Resolve x["y"] into x.y
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.MemberExpression,
			computed: true,
			property: {
				type: "Value",
				valueType: "string"
			}
		}) && regIdentifier.test(node.property.value)) {
			node.computed = false;
			node.property = {
				type: esprima.Syntax.Identifier,
				name: node.property.getValue()
			};
		}
		
		return node;
	},
	// resolve "test"[0] into "t"
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.MemberExpression,
			computed: true,
			object: {
				type: "Value",
				known: true
			},
			property: {
				type: "Value",
				known: true
			}
		})) {
			let object = node.object.getValue();
			let property = node.property.getValue();
			
			let value = object[property];
			
			if (typeof value === "function") {
				return node;
			}

			node = util.Value.from(value);
		}
		
		return node;
	},
	// resolve [].filter into property value
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.MemberExpression,
			computed: false,
			object: {
				type: "Value",
				known: true
			}
		})) {
			node = new util.Value(node);
		}
		
		return node;
	},
	// Resolve call expressions
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.CallExpression,
			callee: {
				type: "Value",
				known: true,
				valueType: "property"
			}
		})) {
			for (let i=0; i<node.arguments.length; i++) {
				if (
					node.arguments[i].type !== "Value" ||
					node.arguments[i].known !== true
				) {
					return node;
				}
			}
			
			let func = node.callee.getValue();
			
			if (typeof func !== "function") return node;
			
			if (func === Number.prototype.toString) {
				node = util.Value.from(func.apply(node.callee.value.getValue(), node.arguments.map(util.getValue)));
			}
		}
		
		return node;
	},
	// Resolve literal unary expressions
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.UnaryExpression,
			argument: {
				type: "Value",
				known: true
			}
		})) {
			let arg = node.argument.getValue();
			
			switch(node.operator) {
				case "+": arg = +arg; break;
				case "-": arg = -arg; break;
				case "~": arg = ~arg; break;
				case "!": arg = !arg; break;
				case "delete": arg = true; break;
				case "void": arg = void arg; break;
				case "typeof": arg = typeof arg; break;
			}
			
			node = util.Value.from(arg);
		}
		
		return node;
	},
	// Resolve update expressions
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.UpdateExpression,
			argument: {
				type: "Value",
				known: true
			}
		})) {
			let arg = node.argument.getValue();
			
			switch(node.operator) {
				case "++": arg = ++arg; break;
				case "--": arg = --arg; break;
			}
			
			node = util.Value.from(arg);
		}
		
		return node;
	},
	// Resolves binary expressions
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.BinaryExpression,
			left: {
				type: "Value",
				known: true
			},
			right: {
				type: "Value",
				known: true
			}
		})) {
			let value;
			let a = node.left.getValue();
			let b = node.right.getValue();
			switch(node.operator) {
				case "instanceof": value = a instanceof b; break;
				case "in": value = a in b; break;
				case "+": value = a + b; break;
				case "-": value = a - b; break;
				case "*": value = a * b; break;
				case "/": value = a / b; break;
				case "%": value = a % b; break;
				case "**": value = a ** b; break;
				case "|": value = a | b; break;
				case "^": value = a ^ b; break;
				case "&": value = a & b; break;
				case "==": value = a == b; break;
				case "!=": value = a != b; break;
				case "===": value = a === b; break;
				case "!==": value = a !== b; break;
				case "<": value = a < b; break;
				case ">": value = a > b; break;
				case "<=": value = a <= b; break;
				case ">=": value = a >= b; break;
				case "<<": value = a << b; break;
				case ">>": value = a >> b; break;
				case ">>>": value = a >>> b; break;
			}

			node = util.Value.from(value);
		}
		
		return node;
	},
	// Resolves logical expressions
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.LogicalExpression,
			left: {
				type: "Value",
				known: true
			},
			right: {
				type: "Value",
				known: true
			}
		})) {
			let value;
			let a = node.left.getValue();
			let b = node.right.getValue();
			switch(node.operator) {
				case "||": value = a || b; break;
				case "&&": value = a && b; break;
			}
			
			if (value === undefined) {
				return node;
			}

			node = util.literal(value);
		}
		
		return node;
	},
	// Resolves literal if statements
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.IfStatement,
			test: {
				type: "Value",
				known: true
			}
		})) {
			if (node.test.getValue()) {
				node = node.consequent;
			} else if (node.alternate) {
				node = node.alternate;
			}
		}
		
		return node;
	},
	// Resolve duplicate block statements
	function(node) {
		if (
			(
				node.type == esprima.Syntax.BlockStatement ||
				node.type == esprima.Syntax.Program
			) &&
			node.body.length === 1 &&
			node.body[0].type == esprima.Syntax.BlockStatement
		) {
			node.body = node.body[0].body;
		}
		
		return node;
	},
	// Resolve call expressions
	/*function(node) {
		if (util.match(node, {
			type: esprima.Syntax.CallExpression
		})) {
			let callee = node.callee;
			// String.fromCharCode
			if (util.match(node, {
				arguments: [
					{
						type: "Value",
						known: true
					}
				],
				callee: {
					type: esprima.Syntax.MemberExpression,
					object: {
						type: esprima.Syntax.Identifier,
						name: "String"
					},
					property: {
						type: esprima.Syntax.Identifier,
						name: "fromCharCode"
					}
				}
			})) {
				node = util.literal(String.fromCharCode.apply(null, node.arguments[0].getValue()));
			} else if (util.match(callee, {
				type: esprima.Syntax.MemberExpression,
				object: {
					type: esprima.Syntax.Literal
				},
				property: {
					type: esprima.Syntax.Identifier,
					name: "split"
				}
			})) {
				console.log(callee.object.value);
				node = util.literal(callee.object.value.split.apply(callee.object.value, node.arguments.map(util.getValue)));
			} else if (util.match(node.callee, {
				type: esprima.Syntax.MemberExpression,
				object: {
					type: esprima.Syntax.Literal
				},
				property: {
					type: esprima.Syntax.Identifier,
					name: "replace"
				}
			})) {
				if (callee.object.value === "") {
					node = util.literal("");
				}
			}
		}
		
		return node;
	},*/
	// Resolve unnecessary string properties
	function(node) {
		if (util.match(node, {
			type: esprima.Syntax.Property,
			key: {
				type: "Value",
				known: true
			}
		}) && regIdentifier.test(node.key.getValue())) {
			node.key = {
				type: esprima.Syntax.Identifier,
				name: node.key.getValue()
			};
		}
		
		return node;
	},
	// Resolve transformed object keys
	function(node) {
		if (node.type == esprima.Syntax.BlockStatement || node.type == esprima.Syntax.Program) {
			let index = null;
			let id;
			for (let i=0; i<node.body.length; i++) {
				if (index === null && util.match(node.body[i], {
					type: esprima.Syntax.VariableDeclaration,
					declarations: [
						{
							type: esprima.Syntax.VariableDeclarator,
							id: {
								type: esprima.Syntax.Identifier
							},
							init: {
								type: "Value",
								valueType: "object",
								known: true
							}
						}
					]
				})) {
					index = i;
					id = node.body[i].declarations[0].id.name;
				} else if (index !== null && util.match(node.body[i], {
					type: esprima.Syntax.ExpressionStatement,
					expression: {
						type: esprima.Syntax.AssignmentExpression,
						operator: "=",
						left: {
							type: esprima.Syntax.MemberExpression,
							object: {
								type: esprima.Syntax.Identifier,
								name: id
							},
							property: {
								type: esprima.Syntax.Identifier
							}
						}
					}
				}) && !node.body[index].declarations[0].init.value.some(function(prop) {
					return prop.key.name == node.body[i].expression.left.property.name;
				})) {
					node.body[index].declarations[0].init.value.push({
						type: esprima.Syntax.Property,
						computed: false,
						key: node.body[i].expression.left.property,
						kind: "init",
						method: false,
						shorthand: false,
						value: node.body[i].expression.right
					});
					node.body.splice(i, 1);
					i--;
				} else {
					index = null;
				}
			}
		}
		
		return node;
	}
];

module.exports = function simplify(program) {
	//let scopeManager = escope.analyze(program);
	
	return util.traverse(program, {
		leave: function(node, parent) {
			for (let i=0; i<rules.length; i++) {
				node = rules[i](node, parent/*, scopeManager*/);
				if (!node) break;
			}
			
			return node;
		}
	});
}
