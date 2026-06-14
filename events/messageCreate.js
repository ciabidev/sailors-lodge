const { Events } = require("discord.js");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const announcePrefix = "!a";
    if (!message.author.bot && message.content.toLowerCase().startsWith(announcePrefix)) {
      const party = await message.client.modules.db.getCurrentParty(message.author.id);
      if (!party) {
        // just send normal DM reply, don't use ephemeral
        await message
          .reply({
            content: "You are not in a party to make an announcement.",
          })
          .catch(() => {});
        return;
      }

      const announcementContent = message.content.slice(announcePrefix.length).trim();
      if (!announcementContent && message.attachments.size === 0 && message.embeds.length === 0)
        return;

      const payload = {
        content: `📢 **${message.author.username}:**\n${announcementContent}`,
        embeds: message.embeds,
        files: Array.from(message.attachments.values()),
      };

      await message.client.modules.announce(message.client, party, payload);

      await message.react("📢").catch(() => {});
    }

    if (!message.guildId || !message.channel?.id) return;
    if (message.webhookId) return;
    const settings = await message.client.modules.db.getSettings(message.guildId);
    const keywordPingsEnabled =
      typeof settings.keywordPingsEnabled === "boolean"
        ? settings.keywordPingsEnabled
        : (process.env.KEYWORD_PINGS_ENABLED ?? process.env.FOLLOWED_PINGS_ENABLED) === "true";

    if (keywordPingsEnabled) {
      (async () => {
        const pingGroups = settings.pingGroups ?? [];
        const keywordGroups = pingGroups.filter(
          (group) => group.keywordChannelId === message.channel.id && group.roleId,
        );
        if (keywordGroups.length === 0) return;
        if (!message.client.keywordPingMessages) {
          message.client.keywordPingMessages = new Map();
        }
        const keywordPingMessages = message.client.keywordPingMessages;
        let messageText;
        if (message.content) messageText = message.content;

        if (!messageText) return;
        for (const group of keywordGroups) {
          const rawKeywords =
            Array.isArray(group.keywords) && group.keywords.length ? group.keywords : [group.name];
          const keywords = rawKeywords
            .map((value) => value.toLowerCase().replace(/\s+/g, " ").trim())
            .filter((value) => value.length > 0);

          const matches = keywords.some((keyword) => {
            const compactKeyword = keyword.replace(/\s+/g, "");
            return (
              messageText.includes(keyword) ||
              (compactKeyword && messageText.includes(compactKeyword))
            );
          });

          if (!matches) continue;

          const raw = (message.content || "").trim();
          const keywordFormatted = raw;
          const label = group.name || "Keyword";
          const content = `${label} party ping triggered by <@${message.author.id}>! <@&${group.roleId}>`;

          const sentMessage = await message.reply({
            content,
            allowedMentions: { roles: [group.roleId], repliedUser: false },
          });

          // const existing = keywordPingMessages.get(message.id) || [];
          // existing.push({ groupName: group.name, roleId: group.roleId, botMessageId: sentMessage.id });
          // keywordPingMessages.set(message.id, existing);
        }
      })();
    }

    await message.client.modules.dockRelay(message);
  },
};
