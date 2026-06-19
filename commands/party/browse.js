const {
  MessageFlags,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} = require("discord.js");


const browsePages = new Collection();

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Learn how Docks replaced the old party browser")
    .addStringOption((option) =>
      option.setName("search").setDescription("Legacy option; use /dock browse instead"),
    ),

  async execute(interaction) {
   
    return interaction.reply({
      content: "`/party browse` was replaced by Docks, which bring live party feeds into your server. Ask a server manager to use `/dock browse` to follow a feed or `/dock publish` to share one. Run `/dock help` to learn more.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
