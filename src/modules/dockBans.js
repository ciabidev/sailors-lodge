const { ContainerBuilder, MessageFlags } = require("discord.js");

async function getValidBanTarget(interaction, dockId, followerGuildId, banned) {
  const dock = await interaction.client.modules.db.getDock(dockId);
  if (
    !dock ||
    !(await interaction.client.modules.dockLevels.guildCanManage(
      interaction.client,
      dock,
      interaction.guildId,
    ))
  ) {
    await interaction.reply({
      content: "You don't have permission to manage that Dock.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const follower = await interaction.client.modules.db.getDockFollower(dockId, followerGuildId);
  const isValidFollower =
    follower &&
    follower.guildId !== dock.guildId &&
    follower.guildId !== interaction.guildId &&
    (banned
      ? follower.banned === true
      : interaction.client.modules.dockLevels.canRead(follower));

  if (!isValidFollower) {
    await interaction.reply({
      content: banned
        ? "I couldn't find that banned follower."
        : "I couldn't find that active follower.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return { dock, follower };
}

async function banFollower(interaction, dockId, followerGuildId, reason) {
  const target = await getValidBanTarget(interaction, dockId, followerGuildId, false);
  if (!target) return;

  const cleanReason = reason.trim();
  if (!cleanReason) {
    return interaction.reply({
      content: "A ban reason is required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.client.modules.db.setDockFollower(dockId, followerGuildId, {
    banned: true,
    banReason: cleanReason,
    bannedAt: new Date(),
    bannedByUserId: interaction.user.id,
    level: "no-access",
  });

  const escapedDockName = interaction.client.modules.escapeMarkdown(target.dock.name);
  const escapedFollowerName = interaction.client.modules.escapeMarkdown(
    target.follower.guildName ?? target.follower.guildId,
  );

  await interaction.reply({
    content: `Banned **${escapedFollowerName}** from **${escapedDockName}**.`,
    flags: MessageFlags.Ephemeral,
  });

  await interaction.client.modules.dockRelay.relayAlert({
    client: interaction.client,
    dockId: target.dock._id,
    components: [
      new ContainerBuilder().addTextDisplayComponents((text) =>
        text.setContent(
          `### 🔨 Dock follower banned\n**${escapedFollowerName}** was banned from **${escapedDockName}**.\n\n**Reason:** ${interaction.client.modules.escapeMarkdown(cleanReason)}\n**Moderator:** ${interaction.user.username}`,
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  }).catch((error) => console.error("[dock-ban] Failed to relay ban alert:", error));
}

async function unbanFollower(interaction, dockId, followerGuildId) {
  const target = await getValidBanTarget(interaction, dockId, followerGuildId, true);
  if (!target) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const escapedDockName = interaction.client.modules.escapeMarkdown(target.dock.name);
  const escapedFollowerName = interaction.client.modules.escapeMarkdown(
    target.follower.guildName ?? target.follower.guildId,
  );

  await interaction.client.modules.dockRelay.relayAlert({
    client: interaction.client,
    dockId: target.dock._id,
    guildIds: [interaction.guildId, target.follower.guildId],
    components: [
      new ContainerBuilder().addTextDisplayComponents((text) =>
        text.setContent(
          `### ✅ Dock follower unbanned\n**${escapedFollowerName}** was unbanned from **${escapedDockName}**.`,
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  }).catch((error) => console.error("[dock-ban] Failed to relay unban alert:", error));

  await interaction.client.modules.db.removeDockFollower(dockId, followerGuildId);
  return interaction.editReply(
    `Unbanned **${escapedFollowerName}** from **${escapedDockName}**. They can follow it again.`,
  );
}

module.exports = { banFollower, unbanFollower };
