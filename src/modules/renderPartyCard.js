const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = async function renderPartyCard(party, interaction, userId) {
  const escape = interaction.client.modules.escapeMarkdown;

  // Invalid party fallback
  if (!party || !party.members || !party.name) {
    return [new TextDisplayBuilder().setContent("Invalid party, or this party has been deleted.")];
  }
  // If the party is deleted
  if (party?.deleted) {
    return [
      new TextDisplayBuilder().setContent(`The party "${escape(party.name)}" has been deleted.`),
    ];
  }

  // If a specific user left the party
  if (userId && party.members && !party.members.some((m) => m.id === userId)) {
    return [new TextDisplayBuilder().setContent(`<@${userId}> You left the party "${escape(party.name)}".`)];
  }

  // Build member list
  const members = party.members.map((m) =>
    m.id === party.host.id
      ? `👑 <@${m.id}> - ${escape(m.username)}`
      : `<@${m.id}> - ${escape(m.username)}`,
  );

  // Build the party card
  const partyCard = new ContainerBuilder()
    .addTextDisplayComponents((t) => t.setContent(`# ${party.name}`))
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (t) => t.setContent(party.description || "No description"),
      (t) => t.setContent(`**Visibility:** ${party.visibility}`),
      (t) =>
        t.setContent(`**${members.length}/${party.memberLimit} Members**\n-# Discord username will be shown next to mention\n${members.join("\n")}`),
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) => t.setContent(`Join Code: ${party.joinCode}\n-# TIP: Use \`!a\` before your message to announce to the party!`));

  // Buttons
  const joinBtn = new ButtonBuilder()
    .setCustomId(`party-join:${party._id}`)
    .setLabel("Join")
    .setStyle(ButtonStyle.Success);

  const leaveBtn = new ButtonBuilder()
    .setCustomId(`party-leave:${party._id}`)
    .setLabel("Leave")
    .setStyle(ButtonStyle.Danger);

  const refreshBtn = new ButtonBuilder()
    .setCustomId(`party-card-refresh:${party._id}`)
    .setLabel("Refresh")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn, refreshBtn);

  return [partyCard, row];
};;
