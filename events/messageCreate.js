const { EmbedBuilder, Events, MessageType } = require("discord.js");
const { ObjectId } = require("mongodb");
const { reportError } = require("../src/reportError");

const configuredDeveloperIds = (process.env.DEV_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

function getMessageText(message) {
  const snapshot = message?.messageSnapshots?.first?.();
  return message?.content || snapshot?.content || "";
}

function findMatchingKeyword(text, keywords = []) {
  const normalizedText = text.toLowerCase();

  return keywords.find((keyword) => {
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (!normalizedKeyword) return false;

    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escapedKeyword}(?=\\s|$)`).test(normalizedText);
  });
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    const devAnnounceMatch = message.content?.trim().match(/^!devannounce(?:\s+(.+))?$/i);
    if (devAnnounceMatch) {
      if (!configuredDeveloperIds.includes(message.author.id)) {
        await message.reply("You are not authorized to publish developer announcements.");
        return;
      }

      if (!message.reference?.messageId) {
        await message.reply("Reply to the message you want to publish with `!devannounce`.");
        return;
      }

      const sourceMessage = await message.channel.messages
        .fetch(message.reference.messageId)
        .catch(() => null);
      if (!sourceMessage) {
        await message.reply("I couldn't fetch the message you replied to.");
        return;
      }

      const customTitle = devAnnounceMatch[1]?.trim();
      const broadcastContent = sourceMessage.content?.replace(/!devannounce\b/gi, "").trim();
      const botAvatar = message.client.user.displayAvatarURL();
      const publishedAt = Math.floor(Date.now() / 1000);
      const announcement = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
          name: "Sailors Lodge Developer Message",
          iconURL: botAvatar,
        })
        .addFields(
          {
            name: "Published by",
            value: `${message.author} • Sailors Lodge Development Team`,
            inline: true,
          },
          {
            name: "Original author",
            value: `${sourceMessage.author}`,
            inline: true,
          },
        );

      const docks = await message.client.modules.db.getDocks();
      const announcedChannelIds = new Set();
      let sent = 0;
      let failed = 0;

      for (const dock of docks) {
        try {
          const targetChannelIds = (await message.client.modules.db.getDockFollowers(dock._id))
            .filter((follower) => message.client.modules.dockLevels.canRead(follower))
            .flatMap((follower) => follower.channelIds ?? [])
            .filter((channelId) => !announcedChannelIds.has(channelId));
          if (targetChannelIds.length === 0) continue;

          const payload = {
            content: broadcastContent || undefined,
            embeds: [announcement, ...sourceMessage.embeds.slice(0, 9)],
            files: Array.from(sourceMessage.attachments.values())
              .slice(0, 10)
              .map((attachment) => attachment.url),
            allowedMentions: { parse: [] },
          };

          for (const channelId of targetChannelIds) {
            if (announcedChannelIds.has(channelId)) continue;

            const channel = await message.client.modules.fetchChannel(message.client, channelId);
            if (!channel) continue;

            await channel.send(payload);
            announcedChannelIds.add(channelId);
          }

          sent += 1;
        } catch (error) {
          failed += 1;
          console.error(`[devannounce] Failed to broadcast to Dock ${dock._id}:`, error);
        }
      }

      await message.react(failed ? "⚠️" : "📣").catch(() => {});
      await message
        .reply(
          `Official announcement sent to ${sent} Dock${sent === 1 ? "" : "s"}` +
            (failed ? `; ${failed} failed.` : "."),
        )
        .catch(() => {});
      return;
    }

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
    const partyCardId = message.client.modules.dockRelay.getPartyIdFromComponents(message);

    if (!message.guildId || !message.channel?.id) return;
    if (message.webhookId && !partyCardId) return;
    if (message.author.bot && message.author.id !== message.client.user.id) return;
    // Party cards created by interactions have a webhook ID. Copies created by
    // relayAlert use channel.send(), so ignore them before they can relay again.
    if (partyCardId && message.author.id === message.client.user.id && !message.webhookId) return;
    if (message.client.dockRelayedPartyCardMessages?.has(message.id)) return; // prevents party cards from bouncing endlessly between connected Dock channels.
    if (
      message.author.id === message.client.user.id &&
      ![MessageType.Default, MessageType.Reply].includes(message.type) &&
      !partyCardId
    )
      // ordinary bot interaction responses are ignored, but party cards are allowed
      return;

    try {
      const { formatRoleMentions } = message.client.modules.mentions;
      const uniqueItems = message.client.modules.uniqueItems;

      // Threads are connected through their dockThreads record, not as channel followers.
      // Route them before the normal channel lookup or they will have no relay jobs.
      if (message.channel.isThread?.()) {
        await message.client.modules.dockRelay.relayThreadMessage(message);
        return;
      }

      // A channel can connect to multiple Docks; level capabilities decide which are writable.
      const dockFollows = await message.client.modules.dockRelay.getWritableDockFollows(
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
        if (publishContent) {
          // The user typed text after !p
          manualSelection = message;
          manualPublishOptions = { content: publishContent };
        } else if (message.reference?.messageId) {
          // !p is replying to a message
          manualSelection = await message.channel.messages
            .fetch(message.reference.messageId)
            .catch(() => null);
        }
      }

      async function getPublishEntries(selectedDockFollows) {
        return (await Promise.all(
          selectedDockFollows.map(async (sendingFollower) => {
            const dock = await message.client.modules.db.getDock(sendingFollower.dockId);

            return {
              dock,
              sendingFollower,
              messageToPublish: dock?.publishMode === "manual" ? manualSelection : message,
              publishOptions: dock?.publishMode === "manual" ? manualPublishOptions : {},
            };
          }),
        ))
          .filter(({ dock }) => Boolean(dock))
          .filter(({ messageToPublish }) => Boolean(messageToPublish));
      }

      async function publishToSelectedDocks(selectedDockFollows) {
        const publishEntries = await getPublishEntries(selectedDockFollows);
        let dockPingThreadMessage = null;
        let dockPingThreadName = null;

        if (!(message.author.bot && message.author.id === message.client.user.id)) {
          const serverPingText = getMessageText(manualSelection) || getMessageText(message);

          const dockFollowsToPing = [];

          for (const { dock, sendingFollower } of publishEntries) {
            const dockMessageText =
              dock.publishMode === "manual"
                ? getMessageText(manualSelection)
                : getMessageText(message);
            const keyword = findMatchingKeyword(dockMessageText, dock.keywords);

            if (
              keyword &&
              (message.client.modules.dockLevels.canPing(sendingFollower.level) ||
                dock.guildId === message.guildId)
            ) {
              dockFollowsToPing.push({
                dock,
                sendingFollower,
                keyword,
              });
            }
          }

          const matchedKeywords = [...new Set(dockFollowsToPing.map(({ keyword }) => keyword))];
          const matchedPingGroups = (settings.pingGroups ?? []).filter(
            (group) => group.roleId && findMatchingKeyword(serverPingText, group.keywords),
          );

          if (matchedKeywords.length > 0 || matchedPingGroups.length > 0) {
            let roleIds = [];
            const labels = matchedPingGroups.map((group) => group.name).filter(Boolean);
            const label = labels.length ? labels.join(", ") : "";
            let pingMessage = null;

            if (matchedKeywords.length > 0) {
              roleIds = uniqueItems(
                dockFollowsToPing.flatMap(
                  ({ sendingFollower, keyword }) => sendingFollower.keywordPings?.[keyword] ?? [],
                ).filter(Boolean),
              );
              const dockNames = dockFollowsToPing
                .map(({ dock }) => message.client.modules.escapeMarkdown(dock.name))
                .join(", ");
              const shouldPingOwnServer = dockFollowsToPing.some(
                ({ sendingFollower }) => sendingFollower.pingOwnServer !== false,
              ); // By now there are multiple follow objects, so we have to check “Do any of the matched Dock follows enable own-server pings?”
              let pingText =
                `${formatRoleMentions(roleIds)} **${dockNames}** ping triggered by <@${message.author.id}>!`.trim();;
              if (!shouldPingOwnServer) {
                pingText = `Dock ping relayed`.trim();
              }
              pingMessage = await message
                .reply({
                  content:
                    `${pingText}`,
                  allowedMentions: { roles: roleIds, repliedUser: false },
                })
                .catch((error) => {
                  console.error("[keyword-ping] Failed to reply:", error);
                  return null;
                });
            
            } else if (matchedPingGroups.length > 0) {
              roleIds = uniqueItems(matchedPingGroups.map((group) => group.roleId).filter(Boolean));
          
              pingMessage = await message
                .reply({
                  content:
                    `${formatRoleMentions(roleIds)} **${label}** ping triggered by <@${message.author.id}>!`.trim(),
                  allowedMentions: { roles: roleIds, repliedUser: false },
                })
                .catch((error) => {
                  console.error("[keyword-ping] Failed to reply:", error);
                  return null;
                });
            }

            if (matchedKeywords.length > 0 && pingMessage) {
              if (!message.client.dockPingMetadata) {
                message.client.dockPingMetadata = new Map();
              }

              // relayMessage checks this map by message id when it adds follower ping roles
              const messageIdToRelay = publishEntries[0]?.messageToPublish.id;

              if (messageIdToRelay) {
                const keywordsByDockId = {};
                for (const { dock, keyword } of dockFollowsToPing) {
                  const dockId = dock._id.toString();
                  keywordsByDockId[dockId] = uniqueItems([
                    ...(keywordsByDockId[dockId] ?? []),
                    keyword,
                  ]);
                }

                message.client.dockPingMetadata.set(messageIdToRelay, {
                  username: message.author.username,
                  keywordsByDockId,
                });
                dockPingThreadMessage = publishEntries[0]?.messageToPublish ?? null;
                dockPingThreadName =
                  `${dockFollowsToPing.map(({ dock }) => dock.name).join(", ")} ping from ${message.guild?.name ?? "server"}`;

                setTimeout(
                  () => {
                    message.client.dockPingMetadata.delete(messageIdToRelay);
                  },
                  60 * 60 * 1000,
                );
              }
            }
          }
        }

        // one discord message may need to be sent through more than one dock
        for (const { dock, sendingFollower, messageToPublish, publishOptions } of publishEntries) {
          const partyId =
            messageToPublish === message
              ? partyCardId
              : message.client.modules.dockRelay.getPartyIdFromComponents(messageToPublish);
          if (message.author.id === message.client.user.id && !partyCardId) {
            return;
          }
          if (partyId) {
            const party = await message.client.modules.db.getParty(new ObjectId(partyId));
            if (party?.visibility === "private") continue;
            if (party) {
              await message.client.modules.dockRelay.relayAlert({
                // relay all party cards as alerts
                client: message.client,
                dockId: dock._id,
                party,
                source: messageToPublish,
                sourceChannelId: messageToPublish.channel.id,
                userId: party.host.id,
              });
              if (messageToPublish.startThread && !messageToPublish.hasThread) {
                await messageToPublish
                  .startThread({
                    name: Array.from(`${party.name}`).slice(0, 100).join(""),
                    autoArchiveDuration: 1440,
                    reason: "Party card dock thread",
                  })
                  .catch(async (error) => {
                    await message.client.modules.dockRelay.reportDockRelayError(error, {
                      client: message.client,
                      dock,
                      follower: sendingFollower,
                      channel: messageToPublish.channel,
                      source: "dock-party-thread",
                    });
                  });
              }
            }
          } else {
            await message.client.modules.dockRelay.relayMessage(
              messageToPublish,
              publishOptions,
              sendingFollower,
            );
          }
        }

        if (dockPingThreadMessage?.startThread && !dockPingThreadMessage.hasThread) {
          await dockPingThreadMessage
            .startThread({
              name: Array.from(dockPingThreadName ?? "Dock ping").slice(0, 100).join(""),
              autoArchiveDuration: 1440,
              reason: "Dock thread relay",
            })
            .catch(async (error) => {
              if (error?.code === "MessageExistingThread") return;

              await message.client.modules.dockRelay.reportDockRelayError(error, {
                client: message.client,
                channel: dockPingThreadMessage.channel,
                source: "dock-ping-thread",
              });
            });
        }
      }

      const publishableDockFollows = (await getPublishEntries(dockFollows))
        .map(({ sendingFollower }) => sendingFollower);
      if (publishableDockFollows.length > 1 && message.author.id !== message.client.user.id) {
        const rememberedDockFollows = message.client.modules.dockTargetPicker.getRemembered(
          message,
          publishableDockFollows,
        );
        if (rememberedDockFollows) {
          await publishToSelectedDocks(rememberedDockFollows);
          return;
        }

        await message.client.modules.dockTargetPicker.prompt(
          message,
          publishableDockFollows,
          publishToSelectedDocks,
        );
        return;
      }

      await publishToSelectedDocks(publishableDockFollows);
    } catch (error) {
      await reportError(error, {
        source: "message-create",
        context: message,
      });
    }
  },
};
