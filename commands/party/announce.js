const { SlashCommandSubcommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("announce")
    .setDescription("Announce something to your party")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message to announce")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    if (!party) {
      return interaction.editReply({
        content: "You are not in a party.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deleteReply();
    // anyone can announce
    interaction.client.modules.sendPartyNotification(interaction, "announce", party, {
      user: interaction.user,
      message: interaction.options.getString("message"),
    });
  },
};