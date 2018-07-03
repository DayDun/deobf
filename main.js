/* global ace, esprima, escodegen, atob */

var editor;

var regIdentifier = /^([a-zA-Z_$][a-zA-Z0-9_$]*)$/;
var hexIdentifier = /_0x[0-9a-f]+/;
var controlFlowString = /^[0-9]+(?:\|[0-9]+)+$/;

var recurseKeys = {
	[esprima.Syntax.AssignmentExpression]: [
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

function traverse(node, modifier, parent) {
	var keys = recurseKeys[node.type];
	for (var i=0; i<keys.length; i++) {
		var childNode = node[keys[i]];
		if (!childNode) {
			continue;
		}
		
		if (Array.isArray(childNode)) {
			for (var j=0; j<childNode.length; j++) {
				node[keys[i]][j] = traverse(childNode[j], modifier, node);
			}
		} else {
			node[keys[i]] = traverse(childNode, modifier, node);
		}
	}
	
	return modifier(node, parent);
}

function rc4(str, key) {
	var s = [], j = 0, x, res = "";
	for (var i = 0; i < 256; i++) {
		s[i] = i;
	}
	for (i = 0; i < 256; i++) {
		j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
		x = s[i];
		s[i] = s[j];
		s[j] = x;
	}
	i = 0;
	j = 0;
	for (var y = 0; y < str.length; y++) {
		i = (i + 1) % 256;
		j = (j + s[i]) % 256;
		x = s[i];
		s[i] = s[j];
		s[j] = x;
		res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
	}
	return res;
}

function mangledNameGenerator(index) {
	var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
	
	var id = "";
	
	while(index >= 0) {
		index += 10;
		
		id = chars[index % chars.length] + id;
		index = (index - (index % chars.length)) / chars.length - 1;
	}
	
	return id;
}

function deobf() {
	var program = esprima.parse(editor.getValue());
	console.log(program);
	
	/*var stringArray = true;
	if (
		program.body[0].type == esprima.Syntax.VariableDeclaration &&
		program.body[0].declarations.length == 1 &&
		program.body[0].declarations[0].init &&
		program.body[0].declarations[0].init.type == esprima.Syntax.ArrayExpression
	) {
		var array = program.body[0].declarations[0].init;
		for (var i=0; i<array.elements.length; i++) {
			if (array.elements[i].type != esprima.Syntax.Literal || typeof array.elements[i].value != "string") {
				stringArray = false;
				break;
			}
		}
	} else {
		stringArray = false;
	}
	console.log(stringArray);*/
	
	var stringArray = document.getElementById("stringArray").checked;
	var rotateStringArray = document.getElementById("rotateArray").checked;
	var stringArrayEncoding = document.getElementById("arrayEncoding").value;
	
	if (stringArray) {
		var index = 0;
		
		var strings = [];
		var elements = program.body[index].declarations[0].init.elements;
		for (var i=0; i<elements.length; i++) {
			strings.push(elements[i].value);
		}
		
		if (rotateStringArray) {
			var rotateAmount = program.body[++index].expression.arguments[1].value + 1;
			while (--rotateAmount) {
				strings.push(strings.shift());
			}
		}
		
		var strFuncName = program.body[++index].declarations[0].id.name;
		
		program.body.splice(0, ++index);
		
		program = traverse(program, function(node) {
			switch(node.type) {
				case esprima.Syntax.CallExpression:
					if (node.callee.name == strFuncName) {
						var value = strings[parseInt(node.arguments[0].value, 16)];
						switch(stringArrayEncoding) {
							case "base64":
								value = atob(value);
								break;
							case "rc4":
								value = atob(value);
								var x = "";
								for (var i=0; i<value.length; i++) {
									x += "%" + ("00" + value.charCodeAt(i).toString(16)).slice(-2);
								}
								value = decodeURIComponent(x);
								value = rc4(value, node.arguments[1].value);
								break;
						}
						node = {
							type: esprima.Syntax.Literal,
							value: value,
							raw: "\"" + value + "\""
						};
					}
					break;
			}
			
			return node;
		});
		
		console.log(strings);
	}
	
	// Do some cleaning
	
	program = traverse(program, function(node) {
		switch(node.type) {
			case esprima.Syntax.MemberExpression:
				if (
					node.computed &&
					node.property.type == esprima.Syntax.Literal &&
					regIdentifier.test(node.property.value)
				) {
					node.computed = false;
					node.property = {
						type: esprima.Syntax.Identifier,
						name: node.property.value
					};
				}
				break;
			case esprima.Syntax.UnaryExpression:
				if (node.operator == "!") {
					if (node.argument.type == esprima.Syntax.ArrayExpression) {
						node = {
							type: esprima.Syntax.Literal,
							value: false,
							raw: "false"
						};
					} else if (node.argument.type == esprima.Syntax.Literal && typeof node.argument.value == "boolean") {
						var value = !node.argument.value;
						node = {
							type: esprima.Syntax.Literal,
							value: value,
							raw: value.toString()
						};
					}
				}
				break;
		}
		
		return node;
	});
	
	// Reverse control flow flattening
	program = traverse(program, function(node) {
		
	});
	
	// Rename variables for easier comprehension
	
	var identifiers = {};
	
	var reserved = [
		"byte", "case", "char", "do", "else", "enum", "eval", "for", "goto",
		"if", "in", "int", "let", "long", "new", "null", "this", "true", "try",
		"var", "void", "with"
	];
	
	var num = 0;
	
	program = traverse(program, function(node, parent) {
		switch(node.type) {
			case esprima.Syntax.Identifier:
				if (parent.type == esprima.Syntax.MemberExpression && parent.property == node) {
					break;
				}
				
				if (hexIdentifier.test(node.name)) {
					if (!(node.name in identifiers)) {
						var id;
						
						do {
							id = mangledNameGenerator(num++);
						} while(reserved.includes(id) || id in identifiers);
						
						identifiers[node.name] = id;
					}
					
					node.name = identifiers[node.name];
				} else {
					identifiers[node.name] = node.name;
				}
				break;
		}
		
		return node;
	});
	
	
	// Done
	
	editor.setValue(escodegen.generate(program, {
		format: {
			quotes: "double"
		}
	}));
}

window.addEventListener("load", function() {
	editor = ace.edit("editor");
	editor.setTheme("ace/theme/xcode");
	editor.session.setMode("ace/mode/javascript");
	
	document.getElementById("deobf").addEventListener("click", deobf);
});