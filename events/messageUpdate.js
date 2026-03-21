const { Events, MessageFlags } = require("discord.js");

function formatFollowedTriggerMessage(message) {
  const escape = message.client?.modules?.escapeMarkdown || ((text) => text);
  const raw = (message.content || "").trim();
  if (!raw) return "*(no message content)*";
  const escaped = escape(raw);
  return escaped.replace(/\n/g, "\n> ");
}

function buildFollowedPingNotice({ groupName, message, roleId, serverPartnerText }) {
  const label = groupName || "Followed";
  const triggerContent = formatFollowedTriggerMessage(message);
  return `${label} party ping from followed server by <@${message.author.id}>! <@&${roleId}>${serverPartnerText}\n\n**Host message:**\n> ${triggerContent}`;
}

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    let message = newMessage;
    if (message.partial) {
      message = await message.fetch().catch(() => null);
      if (!message) return;
    }

    const isWebhookMessage = Boolean(message.webhookId);
    if (message.author?.bot && !isWebhookMessage) return;

    const isFollowedSource = isWebhookMessage || message.flags?.has(MessageFlags.IsCrosspost);
    if (!isFollowedSource) return;
    if (!message.guildId || !message.channel?.id) return;

    const settings = await message.client.modules.db.getSettings(message.guildId);
    const followedPingsEnabled =
      typeof settings.followedPingsEnabled === "boolean"
        ? settings.followedPingsEnabled
        : process.env.FOLLOWED_PINGS_ENABLED === "true";
    if (!followedPingsEnabled) return;

    const channel = message.channel;
    if (!channel) return;

    const followedPingMessages = message.client.followedPingMessages;
    if (!followedPingMessages) return;

    const entries = followedPingMessages.get(message.id);
    if (!entries || entries.length === 0) return;

    const serverPartnerText = process.env.AFFILIATES_CHANNEL_ID
      ? `\n-# this host is part of our <#${process.env.AFFILIATES_CHANNEL_ID}>`
      : "";

    for (const entry of entries) {
      const content = buildFollowedPingNotice({
        groupName: entry.groupName,
        message,
        roleId: entry.roleId,
        serverPartnerText,
      });

      const botMessage = await channel.messages.fetch(entry.botMessageId).catch(() => null);
      if (!botMessage) continue;
      await botMessage.edit({
        content,
        allowedMentions: { roles: [entry.roleId] },
      }).catch(() => {});
    }
  },
};
