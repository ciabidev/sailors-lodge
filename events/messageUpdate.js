const { Events, MessageFlags } = require("discord.js");

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    let message = newMessage;
    if (message.partial) {
      message = await message.fetch().catch(() => null);
      if (!message) return;
    }

    const followedPingMessages = message.client.followedPingMessages;
    if (!followedPingMessages) return;

    const entries = followedPingMessages.get(message.id);
    if (!entries || entries.length === 0) return;

    const isWebhookMessage = Boolean(message.webhookId);
    if (message.author?.bot && !isWebhookMessage) return;
    if (!message.guildId || !message.channel?.id) return;

    const settings = await message.client.modules.db.getSettings(message.guildId);
    const followedPingsEnabled =
      typeof settings.followedPingsEnabled === "boolean"
        ? settings.followedPingsEnabled
        : process.env.FOLLOWED_PINGS_ENABLED === "true";
    if (!followedPingsEnabled) return;

    const channel = message.channel;
    if (!channel) return;

    for (const entry of entries) {
      const raw = (message.content || "").trim();
      const followedFormatted = raw
      const label = entry.groupName || "Followed";
      const content = `${label} party ping from followed server by <@${message.author.id}>! <@&${entry.roleId}>\n\n${followedFormatted}`;

      const botMessage = await channel.messages.fetch(entry.botMessageId).catch(() => null);
      if (!botMessage) continue;
      await botMessage.edit({
        content,
        allowedMentions: { roles: [entry.roleId] },
      }).catch(() => {});
    }
  },
};
