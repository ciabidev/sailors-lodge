const { Events, MessageType } = require("discord.js");
const { ObjectId } = require("mongodb");

function getMessageText(message) {
  const snapshot = message?.messageSnapshots?.first?.();
  return message?.content || snapshot?.content || "";
}

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
    if (message.client.dockRelayedPartyCardMessages?.has(message.id)) return;
    if (
      message.author.id === message.client.user.id &&
      ![MessageType.Default, MessageType.Reply].includes(message.type)
    )
      return;

    try {
      const dockFollower = await message.client.modules.db.getDockFollowForChannel(
        message.channel.id,
      );
      const dock = dockFollower
        ? await message.client.modules.db.getDock(dockFollower.dockId)
        : null;
      const settings = await message.client.modules.db.getSettings(message.guildId);
      const publishPrefix = "!p";
      const publishMode = dock?.publishMode;
      let messageToPublish = message;
      let publishOptions = {};
      let publishThis = Boolean(dock) && publishMode !== "manual";

      if (dock && publishMode === "manual" && /^!p(?:\s|$)/i.test((message.content ?? "").trim())) {
        const publishContent = (message.content ?? "").trim().slice(publishPrefix.length).trim();
        if (publishContent) { // The user typed text after !p
          publishOptions = { content: publishContent };
          publishThis = true;
        } else if (message.reference?.messageId) { // !p is replying to a message
          messageToPublish = await message.channel.messages
            .fetch(message.reference.messageId)
            .catch(() => null);
          publishThis = Boolean(messageToPublish);
        }
      }

      if (!(message.author.bot && message.author.id === message.client.user.id)) {
        const keywordSource = getMessageText(messageToPublish) || getMessageText(message);
        const includesKeyword = (keywords = []) =>
          keywords.some((keyword) =>
            keywordSource.toLowerCase().includes(keyword.toLowerCase().trim()),
          );

        const dockKeywordMatched = includesKeyword(dock?.keywords ?? []);
        const matchedGroups = (settings.pingGroups ?? []).filter(
          (group) => group.roleId && includesKeyword(group.keywords ?? []),
        );

        if (dockKeywordMatched || matchedGroups.length > 0) {
          let roleIds = [];
          const labels = matchedGroups.map((group) => group.name).filter(Boolean);
          const label = labels.length ? labels.join(", ") : "";
          let pingMessage = null;

          if (dockKeywordMatched) {
            roleIds = dockFollower?.pingRoleIds ?? [];
            pingMessage = await message
              .reply({
                content:
                  `${roleIds.map((roleId) => `<@&${roleId}>`).join(" ")} ${dock?.name} ping triggered by <@${message.author.id}>!`.trim(),
                allowedMentions: { roles: roleIds, repliedUser: false },
              })
              .catch((error) => {
                console.error("[keyword-ping] Failed to reply:", error);
                return null;
              });
          } else if (matchedGroups.length > 0) {
            roleIds = matchedGroups.map((group) => group.roleId);
            pingMessage = await message
              .reply({
                content:
                  `${roleIds.map((roleId) => `<@&${roleId}>`).join(" ")} ${label} ping triggered by <@${message.author.id}>!`.trim(),
                allowedMentions: { roles: roleIds, repliedUser: false },
              })
              .catch((error) => {
                console.error("[keyword-ping] Failed to reply:", error);
                return null;
              });
          }
          

          if (dockKeywordMatched && pingMessage && messageToPublish) {
            if (!message.client.dockPingMessages) {
              message.client.dockPingMessages = new Map();
            }

            message.client.dockPingMessages.set(messageToPublish.id, {
              content: `${dock?.name} ping triggered by <@${message.author.id}>!`,
            });
            setTimeout(
              () => {
                message.client.dockPingMessages.delete(messageToPublish.id);
              },
              60 * 60 * 1000,
            );
          }
        }
      }

      if (publishThis && messageToPublish) {
        const partyId = message.client.modules.dockRelay.getPartyIdFromComponents(messageToPublish);

        if (partyId) {
          const party = await message.client.modules.db.getParty(new ObjectId(partyId));
          if (party.visibility === "private") {
            if (!(/^!p(?:\s|$)/i.test((message.content ?? "").trim()))) {
              return;
            }
          }
          if (party) {
            await message.client.modules.dockRelay.relayAlert({ // relay all party cards as alerts
              client: message.client,
              dockId: dock._id,
              party,
              source: message,
              sourceChannelId: messageToPublish.channel.id,
              userId: party.host.id,
            });
          }
        } else {
          await message.client.modules.dockRelay.relayMessage(messageToPublish, publishOptions);
        }
      }

    } catch (error) {
      console.error("[message-create] Failed to relay Dock message:", error);
    }
  },
};
