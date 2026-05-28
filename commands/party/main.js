const registerSubcommandFolder = require("../../src/modules/subcommandFolder");

module.exports = registerSubcommandFolder({
  name: "party",
  description: "Party commands",
  dirname: __dirname,
});
