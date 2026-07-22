module.exports = async function voiceChannelInvite(client, guildId, channelId) {
  if (!channelId) return null;

  const channel = await client.modules.fetchChannel(client, channelId);
  if (!channel || channel.guildId !== guildId || typeof channel.createInvite !== "function") {
    return null;
  }

  const invite = await channel
    .createInvite({
      maxAge: 60 * 60,
      maxUses: 0,
      unique: true,
      reason: "Dock voice ping",
    })
    .catch(() => null);

  return invite?.url ?? null;
};
