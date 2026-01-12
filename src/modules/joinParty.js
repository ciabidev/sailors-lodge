const {
  SlashCommandSubcommandBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
async function joinParty(interaction, joinCode, ephemeral = true) {
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
  const flags = MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0);
  if (interaction.deferred || interaction.replied) {
    message = await interaction.followUp({
      components: [...partyCardComponents],
      flags: [flags],
    });
  } else {
    const response = await interaction.reply({
      components: [...partyCardComponents],
      flags: [flags],
      withResponse: true,
    });

    message = response.resource.message;
  }

  await interaction.client.modules.partyCardCollector(interaction, party, message);

}

module.exports = joinParty;
