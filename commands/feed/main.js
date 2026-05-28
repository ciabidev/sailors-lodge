const registerSubcommandFolder = require("../../src/modules/subcommandFolder");

module.exports = registerSubcommandFolder({
  name: "feed",
  description: "Browse and manage party feeds.",
  dirname: __dirname,
});
