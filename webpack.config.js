const path = require("path");

console.log(__dirname, path.resolve(__dirname, "dist"));

const config = {
	entry: "./src/main.js",
	output: {
		filename: "main.js",
		path: path.resolve(__dirname, "dist"),
		publicPath: "/"
	},
	devtool: "source-map",
	devServer: {
		contentBase: path.join(__dirname, "dist")
	}
};

module.exports = config;
