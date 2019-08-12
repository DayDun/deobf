const fs = require("fs");
const { deobf, beautify } = require("./src/deobf");

let dir = "./tests/";

let tests = {};

fs.readdirSync(dir).forEach(fileName => {
	split = fileName.split(".");
	if (split.length == 2) {
		tests[fileName] = [];
	} else {
		tests[split[0] + "." + split[2]].push(fileName);
	}
});

for (let testName in tests) {
	let expected = beautify(fs.readFileSync(dir + testName, "utf8"));
	
	for (let i=0; i<tests[testName].length; i++) {
		let result = deobf(fs.readFileSync(dir + tests[testName][i], "utf8"));
		
		test(tests[testName][i], () => {
			expect(result).toBe(expected);
		});
	}
}
