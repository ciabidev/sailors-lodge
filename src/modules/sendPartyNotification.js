module.exports = async function sendPartyNotification(
  client,
  type,
  party,
  options = {}
) {
  let emoji, actionText;
  const now = Math.floor(Date.now() / 1000);

  switch (type) {
    case "join":
      emoji = "🟢";
      actionText = `${options.user.username} has joined the party "${party.name}"`;
      break;
    case "leave":
      emoji = "🟠";
      actionText = `${options.user.username} has left the party "${party.name}"`;
      break;
    case "kick":
      emoji = "🔴";
      actionText = `${options.user.username} was removed from "${party.name}" by ${options.actor.username}`;
      break;
    default:
      emoji = "ℹ️";
      actionText = `Update regarding the party "${party.name}"`;
  }

  const messageContent = `${emoji} **${actionText}**${`\n` + options.extra ? options.extra : ""}\n<t:${now}:R>`;

  for (const member of party.members) {
    const user = await client.users.fetch(member.id).catch(() => null);
    if (!user) continue;

    await user.send({ content: messageContent }).catch(() => {});
  }
};
