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
    .setName("leave")
    .setDescription("Leave your party"),
    
    async execute(interaction) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({
          flags: MessageFlags.Ephemeral,
        });
      }

      const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);

      await interaction.client.modules.leaveParty(interaction, party);
    },
};
