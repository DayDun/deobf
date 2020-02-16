const esprima = require("esprima");
const simplify = require("./simplify");

const regIdentifier = /^([a-zA-Z_$][a-zA-Z0-9_$]*)$/;

const functions = [
	Array.prototype.filter
];

module.exports.functions = functions;

function negate(value) {
	return {
		type: esprima.Syntax.UnaryExpression,
		prefix: true,
		operator: "-",
		argument: value
	};
}

module.exports.Value = class Value {
	constructor(node) {
		this.type = "Value";
		this.known = true;
		
		if (node.type === esprima.Syntax.Literal) {
			this.value = node.value;
			if (node.value === null) {
				this.valueType = "null";
			} else if (node.value === undefined) {
				this.valueType = "undefined";
			} else if (typeof node.value === "number") {
				this.valueType = "number";
			} else if (typeof node.value === "string") {
				this.valueType = "string";
			} else if (typeof node.value === "boolean") {
				this.valueType = "boolean";
			} else if (node.value instanceof RegExp) {
				this.valueType = "regex";
			}
		} else if (node.type === esprima.Syntax.ArrayExpression) {
			this.value = node.elements;
			this.valueType = "array";
			for (let i=0; i<this.value.length; i++) {
				if (this.value[i].type != this.type || this.value[i].known === false) {
					this.known = false;
					break;
				}
			}
		} else if (node.type === esprima.Syntax.ObjectExpression) {
			this.value = node.properties;
			this.valueType = "object";
			for (let i=0; i<this.value.length; i++) {
				let prop = this.value[i];
				if (
					prop.key.type != this.type || prop.key.known === false ||
					prop.value.type != this.type || prop.value.known === false
				) {
					this.known = false;
					break;
				}
			}
		} else if (node.type === esprima.Syntax.MemberExpression) {
			this.value = node.object;
			this.known = this.value.known;
			this.property = node.property.name;
			this.valueType = "property";
		}
	}
	
	getValue() {
		if (
			this.valueType === "null" ||
			this.valueType === "undefined" ||
			this.valueType === "number" ||
			this.valueType === "string" ||
			this.valueType === "boolean" ||
			this.valueType === "regex"
		) {
			return this.value;
		} else if (this.valueType === "array") {
			return this.value.map(a => a.getValue());
		} else if (this.valueType === "object") {
			// TODO
			let out = {};
			for (let i=0; i<this.value.length; i++) {
				let prop = this.value[i];
			}
			return out;
		} else if (this.valueType === "property") {
			let value = this.value.getValue();
			let prop = value[this.property];
			if (typeof prop === "function") {
				prop = prop.bind(value);
			}
			return prop;
		}
	}
	
	getEsprimaNode() {
		if (
			this.valueType === "null" ||
			this.valueType === "undefined" ||
			this.valueType === "number" ||
			this.valueType === "string" ||
			this.valueType === "boolean"
		) {
			if (this.value !== this.value) { // NaN
				return {
					type: esprima.Syntax.Identifier,
					name: "NaN"
				};
			} else if (this.value === Infinity) {
				return {
					type: esprima.Syntax.Identifier,
					name: "Infinity"
				};
			} else if (this.value === -Infinity) {
				return negate({
					type: esprima.Syntax.Identifier,
					name: "Infinity"
				});
			} else if (this.value === undefined) {
				return {
					type: esprima.Syntax.Identifier,
					name: "undefined"
				};
			} else if (Math.sign(this.value) === -1 || 1 / this.value === -Infinity) {
				return negate({
					type: esprima.Syntax.Literal,
					value: Math.abs(this.value),
					raw: JSON.stringify(Math.abs(this.value))
				});
			}
			
			return {
				type: esprima.Syntax.Literal,
				value: this.value,
				raw: JSON.stringify(this.value)
			};
		} else if (this.valueType === "regex") {
			return {
				type: esprima.Syntax.Literal,
				value: this.value,
				raw: "/" + this.value.source + "/" + this.value.flags,
				regex: {
					pattern: this.value.source,
					flags: this.value.flags
				}
			};
		} else if (this.valueType === "array") {
			return {
				type: esprima.Syntax.ArrayExpression,
				elements: this.value
			};
		} else if (this.valueType === "object") {
			return {
				type: esprima.Syntax.ObjectExpression,
				properties: this.value
			};
		}  else if (this.valueType === "property") {
			let computed = !regIdentifier.test(this.property);
			let out = {
				type: esprima.Syntax.MemberExpression,
				object: this.value.getEsprimaNode(),
				computed: computed
			};
			
			if (computed) {
				out.property = {
					type: esprima.Syntax.Literal,
					value: this.property,
					raw: JSON.stringify(this.property)
				};
			} else {
				out.property = {
					type: esprima.Syntax.Identifier,
					name: this.property
				};
			}
			
			return out;
		}
	}
	
	static from(value, context) {
		if (
			value === null ||
			value === undefined ||
			typeof value === "number" ||
			typeof value === "string" ||
			typeof value === "boolean" ||
			value instanceof RegExp
		) {
			return new Value({
				type: esprima.Syntax.Literal,
				value: value,
				raw: JSON.stringify(value)
			});
		} else if (Array.isArray(value)) {
			return new Value({
				type: esprima.Syntax.ArrayExpression,
				elements: value.map(a => Value.from(a))
			});
		} else if (typeof value === "object") {
			// TODO
			throw "TODO: Object";
		}
	}
}

let recurseKeys = {
	"Value": [
		//"value"
	],
	[esprima.Syntax.AssignmentExpression]: [
		"left",
		"right"
	],
	[esprima.Syntax.AssignmentPattern]: [
		"left",
		"right"
	],
	[esprima.Syntax.ArrayExpression]: ["elements"],
	[esprima.Syntax.ArrayPattern]: ["elements"],
	[esprima.Syntax.ArrowFunctionExpression]: [
		"params",
		"defaults",
		"rest",
		"body"
	],
	[esprima.Syntax.AwaitExpression]: ["argument"],
	[esprima.Syntax.BlockStatement]: ["body"],
	[esprima.Syntax.BinaryExpression]: [
		"left",
		"right"
	],
	[esprima.Syntax.BreakStatement]: ["label"],
	[esprima.Syntax.CallExpression]: [
		"callee",
		"arguments"
	],
	[esprima.Syntax.CatchClause]: [
		"param",
		"body"
	],
	[esprima.Syntax.ClassBody]: ["body"],
	[esprima.Syntax.ClassDeclaration]: [
		"id",
		"body",
		"superClass"
	],
	[esprima.Syntax.ClassExpression]: [
		"id",
		"body",
		"superClass"
	],
	[esprima.Syntax.ComprehensionBlock]: [
		"left",
		"right"
	],
	[esprima.Syntax.ComprehensionExpression]: [
		"blocks",
		"filter",
		"body"
	],
	[esprima.Syntax.ConditionalExpression]: [
		"test",
		"consequent",
		"alternate"
	],
	[esprima.Syntax.ContinueStatement]: ["label"],
	[esprima.Syntax.DebuggerStatement]: [],
	[esprima.Syntax.DirectiveStatement]: [],
	[esprima.Syntax.DoWhileStatement]: [
		"body",
		"test"
	],
	[esprima.Syntax.EmptyStatement]: [],
	[esprima.Syntax.ExportBatchSpecifier]: [],
	[esprima.Syntax.ExportDeclaration]: [
		"declaration",
		"specifiers",
		"source"
	],
	[esprima.Syntax.ExportSpecifier]: [
		"id",
		"name"
	],
	[esprima.Syntax.ExpressionStatement]: ["expression"],
	[esprima.Syntax.ForStatement]: [
		"init",
		"test",
		"update",
		"body"
	],
	[esprima.Syntax.ForInStatement]: [
		"left",
		"right",
		"body"
	],
	[esprima.Syntax.ForOfStatement]: [
		"left",
		"right",
		"body"
	],
	[esprima.Syntax.FunctionDeclaration]: [
		"id",
		"params",
		"defaults",
		"rest",
		"body"
	],
	[esprima.Syntax.FunctionExpression]: [
		"id",
		"params",
		"defaults",
		"rest",
		"body"
	],
	[esprima.Syntax.GeneratorExpression]: [
		"blocks",
		"filter",
		"body"
	],
	[esprima.Syntax.Identifier]: [],
	[esprima.Syntax.IfStatement]: [
		"test",
		"consequent",
		"alternate"
	],
	[esprima.Syntax.ImportDeclaration]: [
		"specifiers",
		"source"
	],
	[esprima.Syntax.ImportDefaultSpecifier]: ["id"],
	[esprima.Syntax.ImportNamespaceSpecifier]: ["id"],
	[esprima.Syntax.ImportSpecifier]: [
		"id",
		"name"
	],
	[esprima.Syntax.Literal]: [],
	[esprima.Syntax.LabeledStatement]: [
		"label",
		"body"
	],
	[esprima.Syntax.LogicalExpression]: [
		"left",
		"right"
	],
	[esprima.Syntax.MemberExpression]: [
		"object",
		"property"
	],
	[esprima.Syntax.MethodDefinition]: [
		"key",
		"value"
	],
	[esprima.Syntax.ModuleSpecifier]: [],
	[esprima.Syntax.NewExpression]: [
		"callee",
		"arguments"
	],
	[esprima.Syntax.ObjectExpression]: ["properties"],
	[esprima.Syntax.ObjectPattern]: ["properties"],
	[esprima.Syntax.Program]: ["body"],
	[esprima.Syntax.Property]: [
		"key",
		"value"
	],
	[esprima.Syntax.ReturnStatement]: ["argument"],
	[esprima.Syntax.SequenceExpression]: ["expressions"],
	[esprima.Syntax.SpreadElement]: ["argument"],
	[esprima.Syntax.SwitchStatement]: [
		"discriminant",
		"cases"
	],
	[esprima.Syntax.SwitchCase]: [
		"test",
		"consequent"
	],
	[esprima.Syntax.TaggedTemplateExpression]: [
		"tag",
		"quasi"
	],
	[esprima.Syntax.TemplateElement]: [],
	[esprima.Syntax.TemplateLiteral]: [
		"quasis",
		"expressions"
	],
	[esprima.Syntax.ThisExpression]: [],
	[esprima.Syntax.ThrowStatement]: ["argument"],
	[esprima.Syntax.TryStatement]: [
		"block",
		"handlers",
		"handler",
		"guardedHandlers",
		"finalizer"
	],
	[esprima.Syntax.UnaryExpression]: ["argument"],
	[esprima.Syntax.UpdateExpression]: ["argument"],
	[esprima.Syntax.VariableDeclaration]: ["declarations"],
	[esprima.Syntax.VariableDeclarator]: [
		"id",
		"init"
	],
	[esprima.Syntax.WhileStatement]: [
		"test",
		"body"
	],
	[esprima.Syntax.WithStatement]: [
		"object",
		"body"
	],
	[esprima.Syntax.YieldExpression]: ["argument"]
};

module.exports.traverse = function traverse(node, modifier, parent) {
	if (modifier.enter) {
		node = modifier.enter(node, parent);
	}
	let keys = recurseKeys[node.type];
	if (node.type === "Value" && (node.valueType === "array" || node.valueType === "object")) {
		keys = ["value"];
	}
	for (let i=0; i<keys.length; i++) {
		let childNode = node[keys[i]];
		if (!childNode) {
			continue;
		}
		
		if (Array.isArray(childNode)) {
			for (let j=0; j<childNode.length; j++) {
				node[keys[i]][j] = traverse(childNode[j], modifier, node);
			}
		} else {
			node[keys[i]] = traverse(childNode, modifier, node);
		}
	}
	
	if (modifier.leave) {
		node = modifier.leave(node, parent);
	}
	return node;
}

module.exports.match = function match(node, pattern) {
	if (Array.isArray(pattern)) {
		if (node.length !== pattern.length) return false;
		
		return node && pattern.every(function(val, index) {
			return match(node[index], val);
		});
	} else if (typeof pattern !== "object") {
		return node !== undefined && node === pattern;
	} else {
		return node && Object.keys(pattern).every(function(key) {
			return match(node[key], pattern[key]);
		});
	}
};

module.exports.matchString = function matchString(node, stringPattern) {
	let pattern = simplify(esprima.parse(stringPattern)).body[0];
	
	let vars = {};
	
	function match(node, pattern) {
		//console.log(node, pattern);
		if (!node) return !pattern;
		
		if (pattern.type == esprima.Syntax.Identifier) {
			if (pattern.name == "$num$") {
				return node.type == "Value" && node.valueType == "number";
			} else if (pattern.name.startsWith("$")) {
				if (node.type != esprima.Syntax.Identifier) return false;
				
				let name = pattern.name.slice(1);
				if (name in vars) {
					return node.name == vars[name];
				} else {
					vars[name] = node.name;
					return true;
				}
			} else {
				if (node.type != esprima.Syntax.Identifier) return false;
				
				return node.name == pattern.name;
			}
		} else {
			if (node.type != pattern.type) return false;
			
			if (pattern.type === "Value" && pattern.valueType === "regex") {
				return node.value.toString() === pattern.value.toString();
			}
			return Object.keys(pattern).every(function(key) {
				if (key === "range") return true;
				if (!pattern[key]) return !node[key];
				
				if (Array.isArray(pattern[key])) {
					return pattern[key].every(function(val, index) {
						return match(node[key][index], val);
					});
				} else if (typeof pattern[key] !== "object") {
					return node[key] === pattern[key];
				} else {
					return match(node[key], pattern[key]);
				}
			});
		}
	}
	
	return match(node, pattern);
};

module.exports.getValue = function getValue(node) {
	return node.value;
};

module.exports.rc4 = function rc4(str, key) {
	let s = [], x, res = "";
	for (let i = 0; i < 256; i++) {
		s[i] = i;
	}
	let j = 0;
	for (let i = 0; i < 256; i++) {
		j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
		x = s[i];
		s[i] = s[j];
		s[j] = x;
	}
	let i = 0;
	j = 0;
	for (let y = 0; y < str.length; y++) {
		i = (i + 1) % 256;
		j = (j + s[i]) % 256;
		x = s[i];
		s[i] = s[j];
		s[j] = x;
		res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
	}
	return res;
};

module.exports.mangledNameGenerator = function mangledNameGenerator(index) {
	let chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
	
	let id = "";
	
	while(index >= 0) {
		index += 10;
		
		id = chars[index % chars.length] + id;
		index = (index - (index % chars.length)) / chars.length - 1;
	}
	
	return id;
};

module.exports.literal = function literal(value) {
	if (value instanceof RegExp) {
		throw "Can't deal with RegExp literals";
	} else if (value === undefined) {
		return {
			type: esprima.Syntax.Identifier,
			name: "undefined"
		};
	} else if (value !== value) { // NaN
		return {
			type: esprima.Syntax.Identifier,
			name: "NaN"
		};
	} else if (value === Infinity) { // Infinity
		return {
			type: esprima.Syntax.Identifier,
			name: "Infinity"
		};
	} else if (Array.isArray(value)) {
		return {
			type: esprima.Syntax.ArrayExpression,
			elements: value.map(a => literal(a))
		};
	} else if (typeof value == "number" && (Math.sign(value) === -1 || 1 / value === -Infinity)) {
		return negate({
			type: esprima.Syntax.Literal,
			value: Math.abs(value),
			raw: JSON.stringify(value)
		});
	} else {
		return {
			type: esprima.Syntax.Literal,
			value: value,
			raw: JSON.stringify(value)
		};
	}
};
