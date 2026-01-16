const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("edit")
    .setDescription("Edit your party"),
    
    async execute(interaction) {
            const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id); 

      await interaction.client.modules.editParty(interaction, party);
    },
};