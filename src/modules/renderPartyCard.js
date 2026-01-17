const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = async function renderPartyCard(party, interaction) {
  if (!party || !party.members || !party.name) return [new TextDisplayBuilder().setContent("Invalid party, or this party has been deleted.")];
  const members = party.members.map((m) =>
    m.id === party.host.id ? `👑 <@${m.id}> - ${interaction.client.modules.escapeMarkdown(m.username)}` : `<@${m.id}> - ${interaction.client.modules.escapeMarkdown(m.username)}`
  );
  let deletedMessage = new TextDisplayBuilder().setContent(`The party "${interaction.client.modules.escapeMarkdown(party.name)}" has been deleted.`);
  if (party.deleted) {
    return [deletedMessage];
  }
  // Build the container for the party info
  const partyCard = new ContainerBuilder()
    .addTextDisplayComponents((t) => t.setContent(`# ${party.name}`))
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (t) => t.setContent(party.description || "No description"),
      (t) => t.setContent(`Visibility: ${party.visibility}`),
      (t) =>
        t.setContent(`**${members.length}/${party.memberLimit} Members**\n${members.join("\n")}`)
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) => t.setContent(`Join Code: ${party.joinCode}`));
  // Create buttons

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

  // Return as an object ready to send in a message
  return [partyCard, row];
};
