const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  Collection,
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName("party")
      .setDescription("Party commands");

    const dir = __dirname; // commands/moderation
    const files = fs.readdirSync(dir).filter((f) => f !== "main.js");

    for (const file of files) {
      const sub = require(path.join(dir, file));
      builder.addSubcommand(() => sub.data);
    }

    return builder;
  })(),

  async execute(interaction) {
    const name = interaction.options.getSubcommand(true);
    const handler = require(path.join(__dirname, `${name}.js`));
    return handler.execute(interaction);
  },
};
