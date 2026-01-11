const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = async function renderPartyCard(party, interaction) {
  const isOwner = party.owner.id === interaction.user.id;
  const members = party.members.map((m) =>
    m.id === party.owner.id ? `👑 <@${m.id}> - ${m.username}` : `<@${m.id}> - ${m.username}`
  );

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
    

  const row = new ActionRowBuilder().addComponents(editBtn, deleteBtn, joinBtn);

  // Return as an object ready to send in a message
  return [partyCard, row];
};
