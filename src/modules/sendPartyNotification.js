module.exports = async function sendPartyNotification(interaction, type, party, options = {}) {
  let emoji, actionText;
  const now = Math.floor(Date.now() / 1000);
  switch (type) {
    case "join":
      emoji = "🟢";
      actionText = `${interaction.client.modules.escapeMarkdown(options.user.username)} has joined the party "${interaction.client.modules.escapeMarkdown(party.name)}"`;
      break;
    case "leave":
      emoji = "🟠";
      actionText = `${interaction.client.modules.escapeMarkdown(options.user.username)} has left the party "${interaction.client.modules.escapeMarkdown(party.name)}"`;
      break;
    case "kick":
      emoji = "🔴";
      actionText = `${interaction.client.modules.escapeMarkdown(options.user.username)} was removed from "${interaction.client.modules.escapeMarkdown(party.name)}" by ${interaction.client.modules.escapeMarkdown(options.actor.username)}`;
      break;
    default:
      emoji = "ℹ️";
      actionText = `Update regarding the party`;
  }

  console.log(options.extra);
  const extraText = typeof options.extra === "string" ? `\n${options.extra}` : "";

  const messageContent = `${emoji} **${actionText}**${extraText}\n<t:${now}:R>`;
  
  for (const member of party.members) {
    const user = await interaction.client.users.fetch(member.id).catch(() => null);
    if (!user) continue;

    await user.send({ content: messageContent }).catch(() => {});
  }
};
