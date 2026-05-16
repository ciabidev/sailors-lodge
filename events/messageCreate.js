const { Events, MessageFlags } = require("discord.js");

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

    const isFollowedAnnouncement = message.flags.has(MessageFlags.IsCrosspost);
    if (!isFollowedAnnouncement) return;
    if (!message.guildId || !message.channel?.id) return;

    const settings = await message.client.modules.db.getSettings(message.guildId);
    const followedPingsEnabled =
      typeof settings.followedPingsEnabled === "boolean"
        ? settings.followedPingsEnabled
        : process.env.FOLLOWED_PINGS_ENABLED === "true";
    if (!followedPingsEnabled) return;

    const pingGroups = settings.pingGroups ?? [];
    const followedGroups = pingGroups.filter(
      (group) => group.followedChannelId === message.channel.id && group.roleId,
    );
    if (followedGroups.length === 0) return;

    if (!message.client.followedPingMessages) {
      message.client.followedPingMessages = new Map();
    }
    const followedPingMessages = message.client.followedPingMessages;

    const textParts = [];
    if (message.content) textParts.push(message.content);
    if (message.embeds?.length) {
      for (const embed of message.embeds) {
        if (embed?.title) textParts.push(embed.title);
        if (embed?.description) textParts.push(embed.description);
      }
    }
    const messageText = textParts.join("\n").toLowerCase();
    if (!messageText) return;

    for (const group of followedGroups) {
      const rawKeywords =
        Array.isArray(group.followedKeywords) && group.followedKeywords.length
          ? group.followedKeywords
          : [group.name];
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
      const followedFormatted = raw
      const label = group.name || "Followed";
      const content = `${label} party ping from followed server by <@${message.author.id}>! <@&${group.roleId}>\n\n${followedFormatted}`;

      const sentMessage = await message.channel.send({
        content,
        allowedMentions: { roles: [group.roleId] },
      });

      const existing = followedPingMessages.get(message.id) || [];
      existing.push({ groupName: group.name, roleId: group.roleId, botMessageId: sentMessage.id });
      followedPingMessages.set(message.id, existing);
    }
  },
};
