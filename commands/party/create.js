const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("create")
    .setDescription("Create a party. The party card will be visible to everyone.")
    .addBooleanOption((option) =>
      option
        .setName("dm")
        .setDescription("The party message will be messaged to you instead of sent in channel")
        .setRequired(false),
    ),

  async execute(interaction) {
    const client = interaction.client;

    // Check if user is already in a party
    const currentParty = await client.modules.db.getCurrentParty(interaction.user.id);
    if (currentParty) {
      return interaction.reply({
        content: "You are already in a party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await client.modules.partyConfigModal(interaction);
    // the rest is handled in interactionCreate
  },
};
