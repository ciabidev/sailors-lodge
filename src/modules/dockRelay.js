const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { reportError } = require("../reportError");
const RELAY_CONCURRENCY = 4;
const WEBHOOK_CACHE_TTL_MS = 10 * 60 * 1000;

function getPartyIdFromComponents(message) {
  if (!message.components) return null;
  for (const row of message.components ?? []) {
    for (const component of row.components ?? []) {
      const customId = component.customId;
      const match = customId?.match(/^party-(?:join|leave|card-refresh):(.+)$/);
      if (match) return match[1];
    }
  }

  return null;
}

function isPartyCard(message) {
  return Boolean(getPartyIdFromComponents(message));
}

function isDockTargetPrompt(message) {
  // If a thread picker prompt ever lands inside a thread, do not relay the bot's
  // own routing UI as user content.
  return message.components?.some((row) =>
    row.components?.some((component) => component.customId?.startsWith("dock-target")),
  );
}

async function repliedToReference({
  message,
  receivingFollower,
  channel,
  deliveryChannelId = channel.id,
}) {
  // check if the message is replying to another message and relay the reference too
  if (!message.reference?.messageId) return null;

  const original = await message.fetchReference().catch(() => null); // the original message that is being replied to
  if (!original) return null;
  // The reply target can be the original Dock message or one of its webhook
  // copies. Resolve both directions so reply buttons point at the matching
  // counterpart in the server receiving this relay.
  const dockMessage =
    (await message.client.modules.db.getDockMessageFromRoot(original.channel.id, original.id)) ??
    (await message.client.modules.db.getDockMessageFromDelivery(original.channel.id, original.id)); // find the dock message of the replied to message

  let linkedMessage = null;
  if (dockMessage) {
    // If this relay is going back to the publisher, link to the root message
    // instead of sending them to the follower server's webhook copy.
    const isReceivingRoot =
      receivingFollower.guildId === dockMessage.rootGuildId &&
      [deliveryChannelId, channel.id, receivingFollower.threadId].includes(
        dockMessage.rootChannelId,
      );

    if (isReceivingRoot) {
      const rootChannel = await message.client.channels
        .fetch(dockMessage.rootChannelId)
        .catch(() => null);
      linkedMessage = await rootChannel?.messages
        ?.fetch(dockMessage.rootMessageId)
        .catch(() => null);
    } else {
      // Otherwise link to the existing delivery in the destination server.
      const delivery = dockMessage.deliveries?.find(
        (d) =>
          d.guildId === receivingFollower.guildId &&
          (d.channelId === deliveryChannelId || d.threadId === channel.id),
      );
      if (!delivery) return null;
      linkedMessage = await channel.messages.fetch(delivery.messageId).catch(() => null);
    }

    if (!linkedMessage) return null;
  }

  const jumpUrl = linkedMessage?.url ?? original.url;
  const jumpLabel = linkedMessage ? "Jump to reply" : "Jump to reply (in original server)";

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `Reply to ${original.author.username}`,
      iconURL: original.author.displayAvatarURL(),
    })
    .setDescription(original.content?.slice(0, 4096) || "*No text content*");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setURL(jumpUrl).setLabel(jumpLabel).setStyle(ButtonStyle.Link),
  );

  return { embed, row };
}
async function getWritableDockFollows(client, channelId, guildId) {
  // One channel can follow multiple Docks. Return only the follower records that
  // are allowed to send from this channel; callers can fetch the Dock when needed.
  const followers = await client.modules.db.getDockFollowsForChannel(channelId);
  const connections = await Promise.all(
    followers.map(async (follower) => ({
      follower,
      dock: await client.modules.db.getDock(follower.dockId),
    })),
  );

  return connections
    .filter(
      ({ dock, follower }) =>
        dock &&
        client.modules.dockLevels.canRead(follower) &&
        (dock.guildId === guildId || client.modules.dockLevels.canSend(follower.level)),
    )
    .map(({ follower }) => follower);
}

const dockWebhookPromises = new Map();
const dockWebhookCache = new Map();
const DOCK_WEBHOOK_NAME = "Sailors Lodge Dock Webhook";

// Forgets a cached webhook after it fails so the next send resolves a fresh one.
function invalidateDockWebhook(guildId, channelId) {
  const cacheKey = `${guildId}:${channelId}`;
  dockWebhookCache.delete(cacheKey);
  dockWebhookPromises.delete(cacheKey);
}

async function reportDockRelayError(
  error,
  { client, channelId, threadId, userId, source = "dock-relay" } = {},
) {
  const missingPermissions = error?.code === 50013 || error?.rawError?.code === 50013;
  // Discord returns Missing Access when the bot cannot see the target channel,
  // message, or thread even if permissionsFor() cannot name the exact missing bit.
  const missingAccess = error?.code === 50001 || error?.rawError?.code === 50001;

  if (missingPermissions || missingAccess) {
    const thread = threadId ? await client.modules.fetchChannel(client, threadId) : null;
    const channel = channelId
      ? await client.modules.fetchChannel(client, channelId)
      : thread?.parent ?? null;

    await client.modules.dockBotPerms.sendMissingPermissionNotice(client, channel, {
      thread,
      userId,
      fallbackPermissions: missingAccess ? ["Access to this channel or thread"] : [],
    });
    return;
  } else {
    await reportError(error, {
      source,
      notify: false,
      tags: {
        channelId: channelId ?? "",
        threadId: threadId ?? "",
      },
    });
  }
}

async function sendWithDockWebhook({
  client,
  channel,
  dockFollower,
  payload,
  threadId = null,
  source = "dock-relay-message",
}) {
  let webhook = await getDockWebhook(client, channel, dockFollower);
  if (!webhook) return null;

  const relayedMessage = await webhook.send(payload).catch(async (error) => {
    // Unknown Webhook means the saved/cached webhook was deleted; resolve a new
    // one once, then let the normal permission reporter handle any retry failure.
    const unknownWebhook = error?.code === 10015 || error?.rawError?.code === 10015;
    if (!unknownWebhook) {
      await reportDockRelayError(error, {
        client,
        channelId: channel.id,
        threadId,
        source,
      });
      return null;
    }

    invalidateDockWebhook(dockFollower.guildId, channel.id);
    webhook = await getDockWebhook(client, channel, dockFollower);
    if (!webhook) return null;

    return webhook.send(payload).catch(async (retryError) => {
      invalidateDockWebhook(dockFollower.guildId, channel.id);
      await reportDockRelayError(retryError, {
        client,
        channelId: channel.id,
        threadId,
        source,
      });
      return null;
    });
  });

  return relayedMessage;
}

async function resolveDockWebhook(client, channel, dockFollower) {
  const savedWebhook = await client.modules.db.getDockWebhook(
    // get the webhook from mongodb
    dockFollower.guildId,
    channel.id,
  );

  let webhook = null;

  if (savedWebhook?.webhookId) {
    // if the webhook is saved in mongo fetch it from discord
    webhook = await client
      .fetchWebhook(savedWebhook.webhookId, savedWebhook.webhookToken)
      .catch(() => null);

    if (webhook?.channelId === channel.id) {
      return webhook;
    }
  }

  // recover webhooks created before webhooks were stored per channel. This also
  // avoids creating another webhook after a database reset or failed write.
  const channelWebhooks = await channel.fetchWebhooks().catch(() => null);
  webhook = channelWebhooks?.find(
    (candidate) => candidate.name === DOCK_WEBHOOK_NAME && candidate.owner?.id === client.user.id,
  );

  if (!webhook) {
    // if webhook still cannot be found then create a new webhook
    webhook = await channel
      .createWebhook({
        name: DOCK_WEBHOOK_NAME,
        avatar: client.user.displayAvatarURL(),
      })
      .catch(async (error) => {
        await reportDockRelayError(error, {
          client,
          channelId: channel.id,
          source: "dock-webhook",
        });
        return null;
      });
    if (!webhook) return null;
  }

  await client.modules.db.setDockWebhook(dockFollower.guildId, channel.id, {
    guildName: dockFollower.guildName,
    webhookId: webhook.id,
    webhookToken: webhook.token,
  }); // update mongo item

  return webhook;
}

async function getDockWebhook(client, channel, dockFollower) {
  // does the same thing as resolveDockWebhook but checks the cache and also caches the result
  const cacheKey = `${dockFollower.guildId}:${channel.id}`;
  const cached = dockWebhookCache.get(cacheKey);
  if (cached?.expiresAt > Date.now() && cached.webhook?.channelId === channel.id) {
    return cached.webhook;
  }
  if (cached) dockWebhookCache.delete(cacheKey);

  let pending = dockWebhookPromises.get(cacheKey);

  if (!pending) {
    pending = resolveDockWebhook(client, channel, dockFollower)
      .then((webhook) => {
        if (webhook?.channelId === channel.id) {
          dockWebhookCache.set(cacheKey, {
            webhook,
            expiresAt: Date.now() + WEBHOOK_CACHE_TTL_MS,
          });
        }
        return webhook;
      })
      .finally(() => {
        dockWebhookPromises.delete(cacheKey);
      });
    dockWebhookPromises.set(cacheKey, pending);
  }

  return pending;
}

const RELAYED_THREAD_MARKER = "[Relayed]"; // This marks relayed threads. Threads with this marker dont get recreated, preventing infinite thread creation loops.

// we need these functions getForwardedSnapshot, getRelayContent, getRelayEmbeds, getRelayFiles because the discord Forwarded Messages are structured differently than normal ones
function getForwardedSnapshot(message) {
  return message.messageSnapshots?.first?.() ?? null;
}

function getRelayContent(message, options = {}) {
  const snapshot = getForwardedSnapshot(message);
  const content = options.content || message.content || snapshot?.content || null;

  if (!snapshot || !content) return content;
  // append a > to the beginning of the content. the quote should encapsulate the entire message

  // join the content with the newlines and append a single > to the beginning of the content
  return `> -# ***➡️ Forwarded***\n> ${content.split("\n").join("\n> ")}`;
}

function isNativeGifPreviewEmbed(embed, content = "") {
  const data = embed.toJSON?.() ?? embed;
  const providerName = data.provider?.name ?? "";
  const embedUrl = data.url ?? "";

  return (
    /giphy|tenor/i.test(`${providerName} ${embedUrl}`) &&
    Boolean(embedUrl) &&
    content.includes(embedUrl)
  );
}

function getRelayEmbeds(message, content = getRelayContent(message) ?? "") {
  const snapshot = getForwardedSnapshot(message);
  const rawEmbeds = message.embeds?.length ? message.embeds : (snapshot?.embeds ?? []);
  return rawEmbeds.filter((embed) => !isNativeGifPreviewEmbed(embed, content));
}

function getRelayComponents(message) {
  const snapshot = getForwardedSnapshot(message);
  return message.components?.length ? message.components : (snapshot?.components ?? []);
}
function getRelayFiles(message) {
  const snapshot = getForwardedSnapshot(message);
  const attachments = message.attachments?.size ? message.attachments : snapshot?.attachments;
  return attachments?.map((attachment) => attachment.url) ?? [];
}

async function relayThread(thread, sendingFollower = null) {
  if (thread.name?.startsWith(RELAYED_THREAD_MARKER)) return;

  if (!sendingFollower) {
    // (DEPRECATED) legacy/default path where sendingFollower is inferred by thread.
    [sendingFollower] = await getWritableDockFollows(
      thread.client,
      thread.parentId,
      thread.guildId,
    );
  }

  const dock = await thread.client.modules.db.getDock(sendingFollower?.dockId);
  if (!dock) return;

  // One Discord thread can now belong to multiple Dock networks. Only skip when
  // this specific Dock has already indexed this root thread.
  const existingDockThread = await thread.client.modules.db.getDockThreadForDock(
    dock._id,
    thread.id,
  );
  if (existingDockThread) return;

  const receivingFollowers = (await thread.client.modules.db.getDockFollowers(dock._id))
    .map((dockFollower) => ({
      ...dockFollower,
      channelIds: (dockFollower.channelIds ?? [dockFollower.channelId]).filter(
        (channelId) => channelId && channelId !== thread.parentId,
      ),
    }))
    .filter(
      (dockFollower) =>
        dockFollower.channelIds.length > 0 &&
        thread.client.modules.dockLevels.canRead(dockFollower) &&
        !(dock.guildId === sendingFollower.guildId && dockFollower.guildId === dock.guildId),
    );
  if (receivingFollowers.length === 0) return;

  await thread.client.modules.db.indexDockThread({
    dockId: dock._id,
    rootGuildId: thread.guildId,
    rootChannelId: thread.parentId,
    rootThreadId: thread.id,
    name: thread.name,
    deliveries: [],
  });

  const dockMessage = await thread.client.modules.db.getDockMessageFromRoot(
    thread.parentId,
    thread.id,
  );

  const threadTargets = [
    ...new Map(
      receivingFollowers
        .flatMap((receivingFollower) =>
          receivingFollower.channelIds.map((channelId) => ({ receivingFollower, channelId })),
        )
        .map((target) => [target.channelId, target]),
    ).values(),
  ];

  await thread.client.modules.mapWithConcurrency(
    threadTargets,
    RELAY_CONCURRENCY,
    async ({ receivingFollower, channelId }) => {
      const channel = await thread.client.modules.fetchChannel(thread.client, channelId);
      if (!channel?.threads) return;
      const name = Array.from(`${RELAYED_THREAD_MARKER} ${thread.name}`).slice(0, 100).join("");
      const existingLinkedThreads = await thread.client.modules.db.getDockThreads(thread.id);
      const alreadyDeliveredToChannel = existingLinkedThreads.some((dockThread) =>
        (dockThread.deliveries ?? []).some((delivery) => delivery.channelId === channelId),
      );
      if (alreadyDeliveredToChannel) return;

      const messageDelivery = dockMessage?.deliveries?.find(
        (delivery) => delivery.channelId === channelId,
      );

      let relayedThread;
      let relayedMessage = null;
      try {
        if (messageDelivery?.messageId) {
          // if the thread came with a message
          relayedMessage = await channel.messages
            .fetch(messageDelivery.messageId)
            .catch(() => null);
          if (relayedMessage?.startThread) {
            if (relayedMessage.hasThread) {
              relayedMessageAlreadyHasThread = true;
              relayedThread = relayedMessage.thread ?? null;
            } else {
              relayedThread = await relayedMessage.startThread({
                name,
                autoArchiveDuration: thread.autoArchiveDuration ?? 1440,
                reason: "Dock thread relay",
              });
            }
          }
        }

        if (relayedMessage?.hasThread && relayedMessage?.startThread && !relayedThread) return;

        if (!relayedThread && channel.threads) {
          // if the thread didnt come with a message just create one
          relayedThread = await channel.threads.create({
            name,
            autoArchiveDuration: thread.autoArchiveDuration ?? 1440,
            reason: "Dock thread relay",
          });
        }
        if (!relayedThread) return;

        await thread.client.modules.db.addDockThreadDeliveries(dock._id, thread.id, [
          {
            guildId: receivingFollower.guildId,
            channelId,
            threadId: relayedThread.id,
          },
        ]);
      } catch (error) {
        await reportDockRelayError(error, {
          client: thread.client,
          channelId: channel.id,
          source: "dock-thread",
        });
      }
    },
  );
  // catch the starter message and relay it too
  const recentMessages = await thread.messages.fetch({ limit: 10 }).catch(() => null);
  const threadMessages = [...(recentMessages?.values() ?? [])]
    .filter((message) => message.channel.id === thread.id)
    .sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)));

  for (const message of threadMessages) {
    await relayThreadMessage(message);
  }
}

async function relayThreadMessage(message) {
  if (isPartyCard(message)) return;
  if (isDockTargetPrompt(message)) return;

  const initialDockThreads = await message.client.modules.db.getDockThreads(message.channel.id);
  if (!initialDockThreads.length) return;

  // A relayed thread may belong to only one dockThreads record, while the root thread may belong to several. This happens when a thread is forwarded to multiple docks. We should Expand through the shared rootThreadId so sibling relayed threads in other Dock networks can hear each other.
  const dockThreadMap = new Map();
  for (const dockThread of initialDockThreads) {
    dockThreadMap.set(dockThread._id.toString(), dockThread);
  }
  for (const rootThreadId of new Set(
    initialDockThreads.map((dockThread) => dockThread.rootThreadId),
  )) {
    const linkedDockThreads = await message.client.modules.db.getDockThreads(rootThreadId);
    for (const dockThread of linkedDockThreads) {
      dockThreadMap.set(dockThread._id.toString(), dockThread);
    }
  }

  const threadEndpoints = new Map();
  let sendingThread = null;

  for (const dockThread of dockThreadMap.values()) {
    const dock = await message.client.modules.db.getDock(dockThread.dockId);
    if (!dock) continue;

    const activeGuildIds = new Set(
      (await message.client.modules.db.getDockFollowers(dock._id))
        .filter((follower) => message.client.modules.dockLevels.canRead(follower))
        .map((follower) => follower.guildId),
    );
    activeGuildIds.add(dock.guildId);

    const threads = [
      {
        guildId: dockThread.rootGuildId,
        channelId: dockThread.rootChannelId,
        threadId: dockThread.rootThreadId,
      },
      ...(dockThread.deliveries ?? []),
    ].filter((delivery) => delivery.threadId && activeGuildIds.has(delivery.guildId));

    // The sender must be allowed to send through at least one Dock record that
    // contains this Discord thread. That Dock also labels the webhook username.
    const dockSendingThread = threads.find((delivery) => delivery.threadId === message.channel.id);
    if (dockSendingThread && !sendingThread) {
      let canSend = dock.guildId === dockSendingThread.guildId;

      if (!canSend) {
        const sendingFollower = await message.client.modules.db.getDockFollower(
          dock._id,
          dockSendingThread.guildId,
        );
        canSend =
          message.client.modules.dockLevels.canRead(sendingFollower) &&
          message.client.modules.dockLevels.canSend(sendingFollower?.level);
      }

      if (canSend) {
        sendingThread = { ...dockSendingThread, dock };
      }
    }

    // Merge all visible thread endpoints into one bridge and dedupe them so a
    // shared root thread or overlapping delivery is not messaged twice.
    for (const thread of threads) {
      const key = `${thread.guildId}:${thread.channelId}:${thread.threadId}`;
      if (!threadEndpoints.has(key)) {
        threadEndpoints.set(key, { ...thread, dock });
      }
    }
  }

  if (!sendingThread) return;

  const threads = [...threadEndpoints.values()];
  const guildName = message.client.guilds.cache.get(sendingThread.guildId)?.name;
  const username = `${message.author.username} [${sendingThread.dock.name}] [${guildName}]`;
  const formattedUsername =
    Array.from(username).length > 80
      ? Array.from(username).slice(0, 76).join("") + "..."
      : username;
  const existingDockMessage = await message.client.modules.db.getDockMessageFromRoot(
    message.channel.id,
    message.id,
  );

  await message.client.modules.db.indexDockMessage({
    dockId: sendingThread.dock._id,
    rootGuildId: message.guildId,
    rootChannelId: message.channel.id,
    rootMessageId: message.id,
    deliveries: [],
  });

  await message.client.modules.mapWithConcurrency(threads, RELAY_CONCURRENCY, async (thread) => {
    if (thread.threadId === message.channel.id) return;
    if (
      existingDockMessage?.deliveries?.some(
        (delivery) =>
          delivery.guildId === thread.guildId &&
          delivery.channelId === thread.channelId &&
          delivery.threadId === thread.threadId,
      )
    )
      return;

    const targetThread = await message.client.modules.fetchChannel(message.client, thread.threadId);
    if (!targetThread?.isThread?.()) return;

    const channel =
      targetThread.parent ??
      (await message.client.modules.fetchChannel(message.client, thread.channelId));
    if (!channel) return;

    const components = getRelayComponents(message);
    const content = components.length ? "" : getRelayContent(message);
    const embeds = getRelayEmbeds(message, content);
    const files = getRelayFiles(message);
    if (!content && embeds.length === 0 && files.length === 0 && components.length === 0) {
      return;
    }

    const messagePayload = {
      username: formattedUsername,
      avatarURL: message.author.displayAvatarURL(),
      content,
      embeds,
      files,
      components,
      allowedMentions: { users: [message.author.id] },
      flags: components.length ? [MessageFlags.IsComponentsV2] : undefined,
      threadId: thread.threadId,
    };

    if (message.reference?.messageId && !components.length) {
      const reply = await repliedToReference({
        message,
        receivingFollower: thread,
        channel: targetThread,
        deliveryChannelId: thread.channelId,
      });
      if (reply) {
        messagePayload.embeds = [reply.embed, ...messagePayload.embeds];
        messagePayload.components = [reply.row];
      }
    }

    const relayedMessage = await sendWithDockWebhook({
      client: message.client,
      channel,
      dockFollower: thread,
      payload: messagePayload,
      threadId: targetThread.id,
      source: "dock-relay-thread-message",
    });
    if (!relayedMessage) return;
    await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
      {
        guildId: thread.guildId,
        channelId: thread.channelId,
        threadId: thread.threadId,
        messageId: relayedMessage.id,
      },
    ]);
  });
}

async function relayMessage(message, options = {}, sendingFollower = null) {
  if (isPartyCard(message)) return;

  if (!sendingFollower) {
    // Find a Dock this channel has permission to publish to.
    [sendingFollower] = await getWritableDockFollows(
      message.client,
      message.channel.id,
      message.guildId,
    );
  }

  const dock = await message.client.modules.db.getDock(sendingFollower?.dockId);
  if (!dock) return;
  if (
    dock.guildId !== sendingFollower.guildId &&
    (!message.client.modules.dockLevels.canRead(sendingFollower) ||
      !message.client.modules.dockLevels.canSend(sendingFollower.level))
  )
    return;

  const receivingFollowers = (await message.client.modules.db.getDockFollowers(dock._id))
    .map((dockFollower) => ({
      ...dockFollower,
      channelIds: (dockFollower.channelIds ?? [dockFollower.channelId]).filter(
        (channelId) => channelId && channelId !== message.channel.id,
      ),
    }))
    .filter(
      (dockFollower) =>
        dockFollower.channelIds.length > 0 &&
        message.client.modules.dockLevels.canRead(dockFollower) &&
        !(dock.guildId === sendingFollower.guildId && dockFollower.guildId === dock.guildId),
    );
  if (receivingFollowers.length === 0) return;
  const dockPing = message.client.dockPingMetadata?.get(message.id);
  const dockPingKeywords = dockPing?.keywordsByDockId?.[dock._id.toString()] ?? [];
  const relayDockPing =
    dockPingKeywords.length > 0 &&
    (dock.guildId === sendingFollower.guildId ||
      message.client.modules.dockLevels.canPing(sendingFollower.level));
  const { formatRoleMentions } = message.client.modules.mentions;
  const uniqueItems = message.client.modules.uniqueItems;

  await message.client.modules.db.indexDockMessage({
    dockId: dock._id,
    rootGuildId: message.guildId,
    rootChannelId: message.channel.id,
    rootMessageId: message.id,
    deliveries: [],
  });

  const deliveryTargets = receivingFollowers.flatMap((receivingFollower) =>
    receivingFollower.channelIds.map((channelId) => ({ receivingFollower, channelId })),
  );

  await message.client.modules.mapWithConcurrency(
    deliveryTargets,
    RELAY_CONCURRENCY,
    async ({ receivingFollower, channelId }) => {
      const dockMessage = await message.client.modules.db.getDockMessageFromRoot(
        message.channel.id,
        message.id,
      );
      const existingDeliveries = dockMessage?.deliveries ?? [];

      if (existingDeliveries.some((delivery) => delivery.channelId === channelId)) return;
      const channel = await message.client.modules.fetchChannel(message.client, channelId); // this is the channel the message is being relayed to
      if (!channel) return;

      const username = `${message.author.username} [${dock.name}] [${sendingFollower.guildName}]`;
      const formattedUsername =
        Array.from(username).length > 80
          ? Array.from(username).slice(0, 76).join("") + "..."
          : username;
      const components = getRelayComponents(message);
      const content = components.length ? "" : getRelayContent(message, options);

      const messagePayload = {
        username: formattedUsername,
        avatarURL: message.author.displayAvatarURL(),
        content,
        embeds: getRelayEmbeds(message, content),
        files: getRelayFiles(message),
        components,
        allowedMentions: { users: [message.author.id] },
        flags: components.length ? [MessageFlags.IsComponentsV2] : undefined,
      };

      if (message.reference?.messageId) {
        const reply = await repliedToReference({ message, receivingFollower, channel });

        if (reply) {
          messagePayload.embeds = [reply.embed, ...messagePayload.embeds];
          messagePayload.components = [reply.row];
        }
      }
      const relayedMessage = await sendWithDockWebhook({
        client: message.client,
        channel,
        dockFollower: receivingFollower,
        payload: messagePayload,
        source: "dock-relay-message",
      });
      if (!relayedMessage) return;
      let pingRoles = [];

      if (relayDockPing) {
        pingRoles = uniqueItems(
          dockPingKeywords
            .flatMap((keyword) => receivingFollower.keywordPings?.[keyword] ?? [])
            .filter(Boolean),
        );
        const dockName = message.client.modules.escapeMarkdown(dock.name);
        const pingContent = `${dockName} ping triggered by ${dockPing.username}!`;
        messagePayload.content = pingRoles.length
          ? `${formatRoleMentions(pingRoles)} ${pingContent}`
          : pingContent;

        messagePayload.allowedMentions.roles = pingRoles;
        delete messagePayload.username;
        delete messagePayload.avatarURL;

        await channel.send(messagePayload).catch(async (error) => {
          await reportDockRelayError(error, {
            client: message.client,
            channelId: channel.id,
            source: "dock-relay-ping",
          });
        });
      }

      await message.client.modules.db.addDockMessageDeliveries(message.channel.id, message.id, [
        {
          guildId: receivingFollower.guildId,
          channelId,
          messageId: relayedMessage.id,
        },
      ]);
    },
  );
}

async function relayAlert({ client, dockId, guildIds, ...payload }) {
  const dock = await client.modules.db.getDock(dockId);
  if (!dock) return;

  const targetGuildIds = guildIds ? new Set(guildIds) : null;
  const followers = (await client.modules.db.getDockFollowers(dock._id)).filter((follower) =>
    targetGuildIds
      ? targetGuildIds.has(follower.guildId)
      : client.modules.dockLevels.canRead(follower),
  );
  if (followers.length === 0) return;
  if (payload.party && payload.source) {
    await client.modules.db.indexDockMessage({
      dockId: dock._id,
      rootGuildId: payload.source.guildId,
      rootChannelId: payload.source.channel.id,
      rootMessageId: payload.source.id,
      deliveries: [],
    });
  } // index the source party card and its relayed copies so relayThread can find each counterpart and attach relayed threads to the each relayed card
  const alertTargets = followers.flatMap((follower) =>
    (follower.channelIds ?? []).map((channelId) => ({ follower, channelId })),
  );

  await client.modules.mapWithConcurrency(
    alertTargets,
    RELAY_CONCURRENCY,
    async ({ follower, channelId }) => {
      const channel = await client.modules.fetchChannel(client, channelId);
      if (!channel) return;

      if (payload.party) {
        // all party cards in docks get relayed as alerts so we need to detect party cards and rebuild them here
        // we cant rebuild them in messageCreate cause thats not where the party card gets relayed obv
        if (channelId === payload.sourceChannelId) return;

        const components = await client.modules.renderPartyCard(
          payload.party,
          payload.source ?? { client },
          payload.userId,
        );
        const message = await channel
          .send({
            components,
            flags: [MessageFlags.IsComponentsV2],
          })
          .catch(async (error) => {
            await reportDockRelayError(error, {
              client,
              channelId: channel.id,
              source: "dock-party-alert",
            });
            return null;
          });
        if (!message) return;

        if (!client.dockRelayedPartyCardMessages) {
          client.dockRelayedPartyCardMessages = new Set();
        }
        client.dockRelayedPartyCardMessages.add(message.id);
        setTimeout(() => client.dockRelayedPartyCardMessages.delete(message.id), 60 * 60 * 1000);

        await client.modules.db.addPartyCardMessage(payload.party._id, {
          channelId,
          messageId: message.id,
          userId: payload.userId,
          guildId: follower.guildId,
        });

        await client.modules.db.addDockMessageDeliveries(
          payload.source.channel.id,
          payload.source.id,
          [
            {
              guildId: follower.guildId,
              channelId,
              messageId: message.id,
            },
          ],
        );
        // index the source party card and its relayed copies so relayThread can find each counterpart and attach relayed threads to the each relayed card
        return;
      }

      await channel.send(payload).catch(async (error) => {
        await reportDockRelayError(error, {
          client,
          channelId: channel.id,
          source: "dock-alert",
        });
      });
    },
  );
}

async function dockRelay(input) {
  if (input.isThread?.()) {
    return relayThread(input);
  }

  if (input.channel && input.author) {
    if (input.channel.isThread?.()) {
      return relayThreadMessage(input);
    }

    return relayMessage(input);
  }

  return relayAlert(input);
}

module.exports = {
  RELAYED_THREAD_MARKER,
  getPartyIdFromComponents,
  getWritableDockFollows,
  reportDockRelayError,
  relayAlert,
  relayMessage,
  relayThread,
  relayThreadMessage,
};
