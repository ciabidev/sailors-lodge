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
      option.setName("ephemeral").setDescription("Show the card message only to you. You'll have to manually refresh.").setRequired(true)
    ),

  async execute(interaction) {
    // Show modal for party creation
    await interaction.client.modules.partyConfigModal(interaction);

    const modal = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === "party-modal" && i.user.id === interaction.user.id,
      time: 60_000,
    });

    // Create the party in DB
    const party = await modal.client.modules.db.createParty(
      modal.fields.getTextInputValue("name"),
      modal.fields.getTextInputValue("description"),
      modal.fields.getStringSelectValues("visibility")[0],
      parseInt(modal.fields.getTextInputValue("limit")) || 10,
      modal.user
    );
    
  
    const flags =
      MessageFlags.IsComponentsV2 |
      (interaction.options.getBoolean("ephemeral") ? MessageFlags.Ephemeral : 0);

    const response = await modal.reply({
      components: await interaction.client.modules.renderPartyCard(party, interaction),
      flags,
      withResponse: true,
    });


    const message = response.resource.message;

    // Store the card in DB if ephemeral is false

    if (!interaction.options.getBoolean("ephemeral")) {
    await interaction.client.modules.db.addPartyCardMessage(party._id, {
      channelId: message.channelId,
      messageId: message.id,
    });
    }
    // Delegate button handling to reusable collector
    await interaction.client.modules.partyCardCollector(interaction, party, message);
  },
};
