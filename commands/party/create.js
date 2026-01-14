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

    const modal = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === "party-modal" && i.user.id === interaction.user.id,
      time: 60_000,
    });

    // Create the party in DB
    const party = await interaction.client.modules.db.createParty(
      modal.fields.getTextInputValue("name"),
      modal.fields.getTextInputValue("description"),
      modal.fields.getStringSelectValues("visibility")[0],
      parseInt(modal.fields.getTextInputValue("limit")) || 10,
      modal.user
    );

    let dm = false;
    let message;
    if (interaction.guildId === null) {
      dm = true;
    }

    if (interaction.options.getBoolean("dm")) dm = true;

    if (dm) {
      await modal.reply({
        content: "Party card will be sent to you in DM",
        flags: MessageFlags.Ephemeral,
      });
      message = await interaction.user.send({
        components: await interaction.client.modules.renderPartyCard(party, interaction),
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      const response = await modal.reply({
        components: await interaction.client.modules.renderPartyCard(party, interaction),
        flags: MessageFlags.IsComponentsV2,
        withResponse: true,
      });
      message = response.resource.message; // important
    }
    // Store the card in DB if ephemeral is false

    await interaction.client.modules.db.addPartyCardMessage(party._id, {
      channelId: message.channelId,
      messageId: message.id,
    });

    // Delegate button handling to reusable collector
    await interaction.client.modules.partyCardCollector(interaction, party, message);
  },
};
