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
  const isOwner = party.owner.id === interaction.user.id;
  const members = party.members.map((m) =>
    m.id === party.owner.id ? `👑 <@${m.id}> - ${m.username}` : `<@${m.id}> - ${m.username}`
  );
  let deletedMessage = new TextDisplayBuilder().setContent("This party has been deleted.");
  if (party.deleted) {
    deletedMessage = new TextDisplayBuilder().setContent("This party has been deleted.");
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
  const editBtn = new ButtonBuilder()
    .setCustomId("party-edit")
    .setLabel("Edit")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!isOwner);

  const deleteBtn = new ButtonBuilder()
    .setCustomId("party-delete")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!isOwner);


  const joinBtn = new ButtonBuilder()
    .setCustomId("party-join")
    .setLabel("Join")
    .setStyle(ButtonStyle.Success);
    
 const leaveBtn = new ButtonBuilder()
   .setCustomId("party-leave")
   .setLabel("Leave")
   .setStyle(ButtonStyle.Danger);

 const refreshBtn = new ButtonBuilder()
   .setCustomId("party-refresh")
   .setLabel("Refresh")
   .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(editBtn, deleteBtn, joinBtn, leaveBtn, refreshBtn);

  // Return as an object ready to send in a message
  return [partyCard, row];
};
