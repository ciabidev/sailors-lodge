function voiceChannelLabel(client, member, guildId) {
  const channel = member?.voice?.channel;
  if (!channel || channel.guildId !== guildId) return null;

  return `<#${channel.id}>`;
}

module.exports = voiceChannelLabel;
