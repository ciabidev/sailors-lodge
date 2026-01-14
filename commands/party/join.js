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
    .setName("join")
    .setDescription("Join a party via join code")
    .addStringOption((option) =>
      option.setName("code").setDescription("The join code of the party").setRequired(true)
    ),
  async execute(interaction) {
    const joinCode = interaction.options.getString("code");
    await interaction.client.modules.joinParty(interaction, joinCode);
    
  },
};
