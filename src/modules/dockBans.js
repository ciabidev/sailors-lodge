const { ContainerBuilder, MessageFlags } = require("discord.js");

function canTargetGuild(dock, interaction, guildId) {
  return guildId && guildId !== dock.guildId && guildId !== interaction.guildId;
}

async function getManageableDock(interaction, dockId) {
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

  return dock;
}

async function getUnbanTarget(interaction, dockId, followerGuildId) {
  const dock = await getManageableDock(interaction, dockId);
  if (!dock) return null;

  const follower = await interaction.client.modules.db.getDockFollower(dockId, followerGuildId);
  const isValidFollower =
    follower &&
    canTargetGuild(dock, interaction, follower.guildId) &&
    follower.banned === true;

  if (!isValidFollower) {
    await interaction.reply({
      content: "I couldn't find that banned follower.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return { dock, follower };
}

async function getBanTarget(interaction, dockId, followerGuildId) {
  const dock = await getManageableDock(interaction, dockId);
  if (!dock) return null;

  const existingFollower = await interaction.client.modules.db.getDockFollower(
    dockId,
    followerGuildId,
  );

  if (existingFollower) {
    if (!canTargetGuild(dock, interaction, existingFollower.guildId)) {
      await interaction.reply({
        content: "You can't ban that server from this Dock.",
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    if (existingFollower.banned) {
      await interaction.reply({
        content: "That server is already banned from this Dock.",
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    return { dock, follower: existingFollower };
  }

  const guild =
    interaction.client.guilds.cache.get(followerGuildId) ??
    interaction.client.guilds.cache.find(
      (candidate) => candidate.name.toLowerCase() === followerGuildId.toLowerCase(),
    );

  if (!guild || !canTargetGuild(dock, interaction, guild.id)) {
    await interaction.reply({
      content: "I couldn't find that server in the bot's Discord servers.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return {
    dock,
    follower: {
      guildId: guild.id,
      guildName: guild.name,
    },
  };
}

async function banFollower(interaction, dockId, followerGuildId, reason) {
  const target = await getBanTarget(interaction, dockId, followerGuildId);
  if (!target) return;
  
  const escapedDockName = interaction.client.modules.escapeMarkdown(target.dock.name);
  const escapedFollowerName = interaction.client.modules.escapeMarkdown(
    target.follower.guildName ?? target.follower.guildId,
  );
  await interaction.client.modules.dockRelay
    .relayAlert({
      client: interaction.client,
      dockId: target.dock._id,
      components: [
        new ContainerBuilder().addTextDisplayComponents((text) =>
          text.setContent(
            `### 🔨 Dock follower banned\n**${escapedFollowerName}** was banned from **${escapedDockName}**.\n\n**Reason:** ${interaction.client.modules.escapeMarkdown(reason)}\n**Moderator:** ${interaction.user.username}`,
          ),
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    })
    .catch((error) => console.error("[dock-ban] Failed to relay ban alert:", error));
  await interaction.client.modules.db.setDockFollower(dockId, target.follower.guildId, {
    guildName: target.follower.guildName,
    banned: true,
    banReason: reason,
    bannedAt: new Date(),
    bannedByUserId: interaction.user.id,
    level: "no-access",
  });

  await interaction.reply({
    content: `Banned **${escapedFollowerName}** from **${escapedDockName}**.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function unbanFollower(interaction, dockId, followerGuildId) {
  const target = await getUnbanTarget(interaction, dockId, followerGuildId);
  if (!target) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const escapedDockName = interaction.client.modules.escapeMarkdown(target.dock.name);
  const escapedFollowerName = interaction.client.modules.escapeMarkdown(
    target.follower.guildName ?? target.follower.guildId,
  );

  await interaction.client.modules.dockRelay
    .relayAlert({
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
    })
    .catch((error) => console.error("[dock-ban] Failed to relay unban alert:", error));

  await interaction.client.modules.db.removeDockFollower(dockId, followerGuildId);
  return interaction.editReply(
    `Unbanned **${escapedFollowerName}** from **${escapedDockName}**. They can follow it again.`,
  );
}

module.exports = { banFollower, unbanFollower };
