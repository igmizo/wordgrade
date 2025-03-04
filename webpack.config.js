const defaultConfig = require("@wordpress/scripts/config/webpack.config");
const path = require("path");

module.exports = {
  ...defaultConfig,
  entry: {
    index: path.resolve(process.cwd(), "src", "index.js"),
  },
  output: {
    filename: "[name].js",
    path: path.resolve(process.cwd(), "build"),
  },
};
