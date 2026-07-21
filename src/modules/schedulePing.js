const MAX_DELAY_MS = 2_147_483_647;

function schedulePing(client, options) {
  const { channelId, content, roleId, roleIds, sendAt, afterSend } = options;
  const delay = sendAt.getTime() - Date.now();

  if (delay <= 0) {
    throw new Error("Scheduled time must be in the future.");
  }

  if (delay > MAX_DELAY_MS) {
    throw new Error("Scheduled time must be within the next 24 days.");
  }

  const timeout = setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return;

      const message = await channel.send({
        content,
        allowedMentions: { roles: roleIds ?? [roleId].filter(Boolean) },
      });

      if (message.crosspostable) {
        await message.crosspost();
      }

      if (typeof afterSend === "function") {
        await afterSend(message);
      }
    } catch (error) {
      console.error("[scheduled-role-ping] Failed to send scheduled ping:", error);
    }
  }, delay);

  return timeout;
}

module.exports = schedulePing;
