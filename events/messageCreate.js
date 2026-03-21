const { Events } = require("discord.js");
const { TextDisplayBuilder, SectionBuilder, MessageFlags } = require("discord.js");

function formatFollowedMessage(message) {
  const escape = message.client?.modules?.escapeMarkdown || ((text) => text);
  const raw = (message.content || "").trim();
  const escaped = escape(raw);
  return escaped.replace(/\n/g, "\n");
}

function buildFollowedPingNotice({ groupName, message, roleId, serverPartnerText }) {
  const label = groupName || "Followed";
  const followedFormatted = formatFollowedMessage(message);
  return `${label} party ping from followed server by <@${message.author.id}>! <@&${roleId}>${serverPartnerText}\n\n${followedFormatted}`;
}

function getFollowedMessageText(message) {
  const parts = [];
  if (message.content) parts.push(message.content);
  if (message.embeds?.length) {
    for (const embed of message.embeds) {
      if (embed?.title) parts.push(embed.title);
      if (embed?.description) parts.push(embed.description);
    }
  }
  return parts.join("\n").toLowerCase();
}

function normalizeKeyword(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const isWebhookMessage = Boolean(message.webhookId);
    // Allow followed-channel webhook messages to flow; ignore other bots.
    if (message.author.bot && !isWebhookMessage) return;

    const announcePrefix = "!a";
    if (message.content.toLowerCase().startsWith(announcePrefix)) {
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
      // const section = new SectionBuilder()
      //   // Add your announcement text
      //   .addTextDisplayComponents((t) =>
      //     t.setContent(`📢 **${message.author.username}:**\n${announcementContent}`),
      //   )
      //   // Add the thumbnail (avatar) on the side
      //   .setThumbnailAccessory((t) => t.setURL(message.author.displayAvatarURL({ dynamic: true })));

      const payload = {
        content: `📢 **${message.author.username}:**\n${announcementContent}`,
        embeds: message.embeds,
        files: Array.from(message.attachments.values()),
      };

      await message.client.modules.announce(message.client, party, payload);

      await message.react("📢").catch(() => {});
    }

    const isFollowedSource = isWebhookMessage || message.flags.has(MessageFlags.IsCrosspost);
    if (!isFollowedSource) return;
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

    const serverPartnerText = process.env.AFFILIATES_CHANNEL_ID
      ? `\n-# this host is part of our <#${process.env.AFFILIATES_CHANNEL_ID}>`
      : "";

    if (!message.client.followedPingMessages) {
      message.client.followedPingMessages = new Map();
    }
    const followedPingMessages = message.client.followedPingMessages;

    const messageText = getFollowedMessageText(message);
    if (!messageText) return;

    for (const group of followedGroups) {
      const rawKeywords =
        Array.isArray(group.followedKeywords) && group.followedKeywords.length
          ? group.followedKeywords
          : [group.name];
      const keywords = rawKeywords
        .map((value) => normalizeKeyword(value))
        .filter((value) => value.length > 0);

      const matches = keywords.some((keyword) => {
        const compactKeyword = keyword.replace(/\s+/g, "");
        return (
          messageText.includes(keyword) ||
          (compactKeyword && messageText.includes(compactKeyword))
        );
      });

      if (!matches) continue;

      const sentMessage = await message.channel.send({
        content: buildFollowedPingNotice({
          groupName: group.name,
          message,
          roleId: group.roleId,
          serverPartnerText,
        }),
        allowedMentions: { roles: [group.roleId] },
      });

      const existing = followedPingMessages.get(message.id) || [];
      existing.push({ groupName: group.name, roleId: group.roleId, botMessageId: sentMessage.id });
      followedPingMessages.set(message.id, existing);
    }
  },
};
