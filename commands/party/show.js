const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const e = require("express");

// show the party card for your current party

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("show")
    .setDescription("Show the party card for your current party")
    .addBooleanOption((option) =>
      option
        .setName("dm")
        .setDescription("The party message will be messaged to you instead of sent in channel")
        .setRequired(false),
    ),
    
  async execute(interaction) {
    const dm = interaction.options?.getBoolean("dm") ?? interaction.guildId === null;
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


    if (interaction.guildId !== null) { // command used in a server
      if (dm) {
        await interaction.reply({
          content: "Party card will be sent to you in DM",
          flags: [MessageFlags.Ephemeral],
        });
        message = await interaction.user.send({
          components: [...partyCardComponents],
          flags: [MessageFlags.IsComponentsV2],
          withResponse: true,
        });
      } else {
        const response = await interaction.reply({
          components: [...partyCardComponents],
          flags: [MessageFlags.IsComponentsV2],
          withResponse: true,
        });
        message = response.resource.message;
      }
      
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
      userId: interaction.user.id,
      messageId: message.id,
      guildId: interaction.guildId,
    });
  },
};