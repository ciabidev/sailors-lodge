const {
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("create")
    .setDescription("Create a party. The party card will be visible to everyone.")
    .addBooleanOption((option) =>
      option.setName("dm").setDescription("The party message will be messaged to you instead of sent in channel").setRequired(true)
    ),

  async execute(interaction) {
    // Show modal for party creation
    // check if the user is already in a party
    const currentParty = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    if (currentParty) {
      return interaction.reply({
        content: "You are already in a party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.client.modules.partyConfigModal(interaction);
  },
};
