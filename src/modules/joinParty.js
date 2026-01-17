const { TextDisplayBuilder, MessageFlags } = require("discord.js");

async function joinParty(interaction, joinCode) {
  const db = interaction.client.modules.db;
    // Fetch party
  let party = await db.getPartyFromJoinCode(joinCode);
  if (!party) {
    return interaction.reply({
      components: [new TextDisplayBuilder().setContent("Invalid join code.")],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }
  // check if the party was deleted 
  if (party.deleted) {
    return interaction.reply({
      components: [new TextDisplayBuilder().setContent("This party has been deleted.")],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }
  // Check if user already in party
  if (party.members.some((m) => m.id === interaction.user.id)) {
    return interaction.reply({
      components: [new TextDisplayBuilder().setContent("You are already a member of this party.")],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }

  // Check party limit
  if (party.members.length >= party.memberLimit) {
    return interaction.reply({
      components: [new TextDisplayBuilder().setContent("This party is full.")],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }

  // Check if user is already in another party
  const currentParty = await db.getCurrentParty(interaction.user.id);
  if (currentParty) {
    return interaction.reply({
      components: [new TextDisplayBuilder().setContent("You are already in a party.")],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }

  // Add user to party
  party.members.push({ id: interaction.user.id, username: interaction.user.username });
  await db.updateParty(party._id, { $set: { members: party.members } }, interaction);

  // Send join notification
  await interaction.client.modules.sendPartyNotification(interaction, "join", party, {
    user: interaction.user,
  });

  // Render the party card components
  const partyCardComponents = await interaction.client.modules.renderPartyCard(party, interaction);

  let message;
  if (interaction.guildId) {
    // Server: ephemeral confirmation + persistent DM
    await interaction.reply({
      components: [new TextDisplayBuilder().setContent("Party card will be sent to you in DM")],
      flags: [MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral],
    });

    // Send persistent card in DM
    message = await interaction.user.send({
      components: [...partyCardComponents],
      flags: [MessageFlags.IsComponentsV2], // persistent
      withResponse: true,
    });
  } else {
    // DM context: persistent card directly
    response = await interaction.reply({
      components: [...partyCardComponents],
      flags: [MessageFlags.IsComponentsV2], // persistent
      withResponse: true,
    });

    message = response.resource.message;
  }
  // Store party card in DB
  await interaction.client.modules.db.addPartyCardMessage(party._id, {
    channelId: message.channelId,
    messageId: message.id,
    userId: interaction.user.id,
  });

  await interaction.client.modules.updatePartyCards(interaction, party);
}

module.exports = joinParty;
