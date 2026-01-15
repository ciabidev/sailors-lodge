const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
async function joinParty(interaction, joinCode) {
  let party = await interaction.client.modules.db.getPartyFromJoinCode(joinCode);

  async function dynamicReply(interaction, message) {
    if (interaction.replied || interaction.deferred) {
      // Interaction already handled: update instead
      return interaction
        .editReply({
          components: [new TextDisplayBuilder().setContent(message)],
        })
        .catch(() => {});
    } else {
      return interaction.reply({
        components: [new TextDisplayBuilder().setContent(message)],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
    }  }

  if (!party) return dynamicReply(interaction, "Invalid join code.");
  if (party.members.some((m) => m.id === interaction.user.id))
    return dynamicReply(interaction, "You are already a member of this party.");
  if (party.members.length >= party.memberLimit)
    return dynamicReply(interaction, "This party is full.");
  // check if the user is already in a party
  const currentParty = await interaction.client.modules.db.getCurrentParty(interaction.user.id);
  if (currentParty) {
    return dynamicReply(interaction, "You are already in a party.");
  }
  // ---- ADD USER TO PARTY ----
  party.members.push(interaction.user);
  await interaction.client.modules.db.updateParty(
    party._id,
    { $set: { members: party.members } },
    interaction
  );

  await interaction.client.modules.sendPartyNotification(interaction, "join", party, {
    user: interaction.user,
  });

  const partyCardComponents = await interaction.client.modules.renderPartyCard(party, interaction);
  
  let message;
  if (interaction.deferred || interaction.replied) {
    message = await interaction.user.send({
      components: [...partyCardComponents],
      flags: [MessageFlags.IsComponentsV2 ],
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
}

module.exports = joinParty;
