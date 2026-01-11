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
  // ---- VALIDATION ----
async function replyError(interaction, message) {
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
  }
}

  if (!party) return replyError(interaction, "Invalid join code.");
  if (party.members.some((m) => m.id === interaction.user.id))
    return replyError(interaction, "You are already a member of this party.");
  if (party.members.length >= party.memberLimit)
    return replyError(interaction, "This party is full.");

  // ---- ADD USER TO PARTY ----
  party.members.push(interaction.user);
  await interaction.client.modules.db.updateParty(
    party._id,
    { $set: { members: party.members } },
    interaction
  );

  await interaction.client.modules.sendPartyNotification(interaction.client, "join", party, {
    user: interaction.user,
  });

  // ---- RENDER INITIAL PARTY CARD ----
  const partyCardComponents = await interaction.client.modules.renderPartyCard(party, interaction);

  // Buttons: Leave + Refresh
  const leaveBtn = new ButtonBuilder()
    .setCustomId("party-leave")
    .setLabel("Leave")
    .setStyle(ButtonStyle.Danger);

  const refreshBtn = new ButtonBuilder()
    .setCustomId("party-refresh")
    .setLabel("Refresh")
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(leaveBtn, refreshBtn);

  const response = await interaction.reply({
    components: [...partyCardComponents, buttonRow],
    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    withResponse: true,
  });

  const message = response.resource.message;
  await interaction.client.modules.partyCardCollector(interaction, party, message);

  // ---- COLLECTOR FOR BUTTONS ----
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 10 * 60_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (btn) => {
    if (btn.customId === "party-leave") {
      // Remove user
      const newMembers = party.members.filter((m) => m.id !== interaction.user.id);
      await interaction.client.modules.db.updateParty(
        party._id,
        { $set: { members: newMembers } },
        interaction
      );
      party.members = newMembers;

      await btn.update({
        components: [new TextDisplayBuilder().setContent("You have left the party.")],
      });

      collector.stop();
      return;
    }

    if (btn.customId === "party-refresh") {
      party = await interaction.client.modules.db.getPartyFromJoinCode(joinCode);
      const updatedCard = await interaction.client.modules.renderPartyCard(party, interaction);

      // Defer interaction to prevent timeout
      await btn.deferUpdate();

      // Edit ephemeral message
      await btn.editReply({
        components: [...updatedCard, buttonRow],
      });
    }
  });
}

module.exports = joinParty;
