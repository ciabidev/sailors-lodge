const {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  PermissionsBitField,
  MessageFlags,
  Collection,
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName("settings")
      .setDescription("Manage settings for your server.");

    const dir = __dirname; // commands/moderation
    const files = fs.readdirSync(dir).filter((f) => f !== "main.js");

    for (const file of files) {
      const sub = require(path.join(dir, file));

      if (sub.data instanceof SlashCommandSubcommandGroupBuilder) {
        builder.addSubcommandGroup(() => sub.data);
        continue;
      }

      if (sub.data instanceof SlashCommandSubcommandBuilder) {
        builder.addSubcommand(() => sub.data);
        continue;
      }

      throw new Error(`Unknown admin command builder in ${file}`);
    }

    return builder;
  })(),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const name = group ?? interaction.options.getSubcommand(true);
    const normalizedName = name.replace(/-/g, "");
    const handler = require(path.join(__dirname, `${normalizedName}.js`));
    return handler.execute(interaction);
  },

  async autocomplete(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const name = group ?? interaction.options.getSubcommand(true);
    const normalizedName = name.replace(/-/g, "");
    const handler = require(path.join(__dirname, `${normalizedName}.js`));
    if (!handler.autocomplete) return;
    return handler.autocomplete(interaction);
  },
};
