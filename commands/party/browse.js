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
    .setDescription("Browse active parties")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search for a party by name"),
    ),

  async execute(interaction) {
   
    return interaction.reply({
      content: "`/party browse` was removed in favor of Docks. With the new Dock system, server owners and admins can add live party feeds to the server with `/dock browse` and `/dock publish`! ",
      flags: MessageFlags.Ephemeral,
    });
  },
};
