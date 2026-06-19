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
    const partyCardId = message.client.modules.dockRelay.getPartyIdFromComponents(message);
    if (
      message.author.id === message.client.user.id &&
      ![MessageType.Default, MessageType.Reply].includes(message.type) &&
      !partyCardId
    ) // ordinary bot interaction responses are ignored, but party cards are allowed
      return;

    try {
      // a channel can be connected to multiple docks now, but only owners and contributors can publish
      const dockConnections =
        await message.client.modules.dockRelay.getWritableConnections(
          message.client,
          message.channel.id,
          message.guildId,
        );
      const settings = await message.client.modules.db.getSettings(message.guildId);
      const publishPrefix = "!p";
      const isPublishCommand = /^!p(?:\s|$)/i.test((message.content ?? "").trim());
      let manualSelection = null;
      let manualPublishOptions = {};

      // keep the !p selection separate because the same channel can have manual and automatic docks
      if (isPublishCommand) {
        const publishContent = (message.content ?? "").trim().slice(publishPrefix.length).trim();
        if (publishContent) { // The user typed text after !p
          manualSelection = message;
          manualPublishOptions = { content: publishContent };
        } else if (message.reference?.messageId) { // !p is replying to a message
          manualSelection = await message.channel.messages
            .fetch(message.reference.messageId)
            .catch(() => null);
        }
      }

      // decide what each dock gets before relaying so every dock can respect its own publish mode
      const relayJobs = dockConnections
        .map(({ dock, follower }) => ({
          dock,
          follower,
          messageToPublish: dock.publishMode === "manual" ? manualSelection : message,
          publishOptions: dock.publishMode === "manual" ? manualPublishOptions : {},
        }))
        .filter(({ messageToPublish }) => Boolean(messageToPublish));

      if (!(message.author.bot && message.author.id === message.client.user.id)) {
        const keywordSource = getMessageText(manualSelection) || getMessageText(message);
        const includesKeyword = (source, keywords = []) =>
          keywords.some((keyword) =>
            source.toLowerCase().includes(keyword.toLowerCase().trim()),
          );

        // check each dock separately because docks sharing a channel can have different keywords
        const matchingDockConnections = dockConnections.filter(({ dock }) => {
          const source = dock.publishMode === "manual"
            ? getMessageText(manualSelection)
            : getMessageText(message);
          return includesKeyword(source, dock.keywords ?? []);
        });
        const dockKeywordMatched = matchingDockConnections.length > 0;
        const matchedGroups = (settings.pingGroups ?? []).filter(
          (group) => group.roleId && includesKeyword(keywordSource, group.keywords ?? []),
        );

        if (dockKeywordMatched || matchedGroups.length > 0) {
          let roleIds = [];
          const labels = matchedGroups.map((group) => group.name).filter(Boolean);
          const label = labels.length ? labels.join(", ") : "";
          let pingMessage = null;

          if (dockKeywordMatched) {
            roleIds = [...new Set(
              matchingDockConnections.flatMap(({ follower }) => follower.pingRoleIds ?? []),
            )];
            const dockNames = matchingDockConnections.map(({ dock }) => dock.name).join(", ");
            pingMessage = await message
              .reply({
                content:
                  `${roleIds.map((roleId) => `<@&${roleId}>`).join(" ")} ${dockNames} ping triggered by <@${message.author.id}>!`.trim(),
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
          

          if (dockKeywordMatched && pingMessage) {
            if (!message.client.dockPingMessages) {
              message.client.dockPingMessages = new Map();
            }

            // relayMessage checks this map by message id when it adds follower ping roles
            const publishedMessageIds = [
              ...new Set(relayJobs.map(({ messageToPublish }) => messageToPublish.id)),
            ];
            for (const messageId of publishedMessageIds) {
              message.client.dockPingMessages.set(messageId, {
                content: `${matchingDockConnections.map(({ dock }) => dock.name).join(", ")} ping triggered by <@${message.author.id}>!`,
              });
            }
            setTimeout(
              () => {
                for (const messageId of publishedMessageIds) {
                  message.client.dockPingMessages.delete(messageId);
                }
              },
              60 * 60 * 1000,
            );
          }
        }
      }

      // one discord message may need to be sent through more than one dock
      for (const { dock, follower, messageToPublish, publishOptions } of relayJobs) {
        const partyId = messageToPublish === message
          ? partyCardId
          : message.client.modules.dockRelay.getPartyIdFromComponents(messageToPublish);
        if (partyId) {
          const party = await message.client.modules.db.getParty(new ObjectId(partyId));
          if (party?.visibility === "private") continue;
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
          await message.client.modules.dockRelay.relayMessage(
            messageToPublish,
            publishOptions,
            follower,
          );
        }
      }

    } catch (error) {
      console.error("[message-create] Failed to relay Dock message:", error);
    }
  },
};
