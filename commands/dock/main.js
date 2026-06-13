const registerSubcommandFolder = require("../../src/modules/subcommandFolder");

module.exports = registerSubcommandFolder({
  name: "dock",
  description: "Browse and manage Docks.",
  dirname: __dirname,
});
