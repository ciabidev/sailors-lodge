const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

// show the party card for your current party

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("show")
    .setDescription("Show the party card for your current party"),
        
  async execute(interaction) {
    const party = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
    if (!party) {
      await interaction.reply({
        content: "You are not in a party.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const partyCardComponents = await interaction.client.modules.renderPartyCard(party, interaction);

    let message;

    if (interaction.deferred || interaction.replied) {
      message = await interaction.followUp({
        components: [...partyCardComponents],
        flags: [MessageFlags.IsComponentsV2],
      });
    } else {
      const response = await interaction.reply({
        components: [...partyCardComponents],
        flags: [MessageFlags.IsComponentsV2],
        withResponse: true,
      });

      message = response.resource.message;
    }

    await interaction.client.modules.db.addPartyCardMessage(party._id, {
      channelId: message.channelId,
      messageId: message.id,
    });

    await interaction.client.modules.partyCardCollector(interaction, party, message);
  },
};