const { Events } = require("discord.js");

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    let message = newMessage;
    if (message.partial) {
      message = await message.fetch().catch(() => null);
      if (!message) return;
    }

    const keywordPingMessages = message.client.keywordPingMessages;
    if (!keywordPingMessages) return;

    const entries = keywordPingMessages.get(message.id);
    if (!entries || entries.length === 0) return;

    if (!message.guildId || !message.channel?.id) return;

    const settings = await message.client.modules.db.getSettings(message.guildId);
    const keywordPingsEnabled =
      typeof settings.keywordPingsEnabled === "boolean"
        ? settings.keywordPingsEnabled
        : (process.env.KEYWORD_PINGS_ENABLED ?? process.env.FOLLOWED_PINGS_ENABLED) === "true";
    if (!keywordPingsEnabled) return;

    const channel = message.channel;
    if (!channel) return;

    for (const entry of entries) {
      const raw = (message.content || "").trim();
      const keywordFormatted = raw
      const label = entry.groupName || "Keyword";
      const content = `${label} party ping triggered by <@${message.author.id}>! <@&${entry.roleId}>\n\n${keywordFormatted}`;

      const botMessage = await channel.messages.fetch(entry.botMessageId).catch(() => null);
      if (!botMessage) continue;
      await botMessage.edit({
        content,
        allowedMentions: { roles: [entry.roleId] },
      }).catch(() => {});
    }
  },
};
