const { ContainerBuilder, MessageFlags } = require("discord.js");

function canTargetGuild(interaction, guildId) {
  return guildId && guildId !== interaction.guildId;
}

async function getOwnerDocks(interaction) {
  return interaction.client.modules.db.getPublishedDocksForGuild(interaction.guildId);
}

async function getUnbanTarget(interaction, followerGuildId) {
  const ban = await interaction.client.modules.db.getDockServerBan(
    interaction.guildId,
    followerGuildId,
  );

  if (!ban || !canTargetGuild(interaction, ban.targetGuildId)) {
    await interaction.reply({
      content: "I couldn't find that banned server.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return {
    ownerGuildId: interaction.guildId,
    ownerGuildName: ban.ownerGuildName ?? interaction.guild.name,
    follower: {
      guildId: ban.targetGuildId,
      guildName: ban.targetGuildName,
    },
  };
}

async function getBanTarget(interaction, followerGuildId) {
  const existingBan = await interaction.client.modules.db.getDockServerBan(
    interaction.guildId,
    followerGuildId,
  );

  const ownerDocks = await getOwnerDocks(interaction);
  const followers = ownerDocks.length
    ? await interaction.client.modules.db.getManyDockFollowers(
        ownerDocks.map((dock) => dock._id),
      )
    : [];
  const existingFollower = followers.find((follower) => follower.guildId === followerGuildId);

  if (existingFollower) {
    if (!canTargetGuild(interaction, existingFollower.guildId)) {
      await interaction.reply({
        content: "You can't ban that server.",
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    if (existingBan) {
      await interaction.reply({
        content: "That server is already banned.",
        flags: MessageFlags.Ephemeral,
      });
      return null;
    }

    return {
      ownerGuildId: interaction.guildId,
      ownerGuildName: interaction.guild.name,
      follower: existingFollower,
    };
  }

  if (existingBan) {
    await interaction.reply({
      content: "That server is already banned.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const guild =
    interaction.client.guilds.cache.get(followerGuildId) ??
    interaction.client.guilds.cache.find(
      (candidate) => candidate.name.toLowerCase() === followerGuildId.toLowerCase(),
    );

  if (!guild || !canTargetGuild(interaction, guild.id)) {
    await interaction.reply({
      content: "I couldn't find that server in the bot's Discord servers.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const existingGuildBan = await interaction.client.modules.db.getDockServerBan(
    interaction.guildId,
    guild.id,
  );
  if (existingGuildBan) {
    await interaction.reply({
      content: "That server is already banned.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return {
    ownerGuildId: interaction.guildId,
    ownerGuildName: interaction.guild.name,
    follower: {
      guildId: guild.id,
      guildName: guild.name,
    },
  };
}

async function relayServerBanAlert(interaction, components, guildIds = null) {
  const ownerDocks = await getOwnerDocks(interaction);
  await Promise.all(
    ownerDocks.map((dock) =>
      interaction.client.modules.dockRelay
        .relayAlert({
          client: interaction.client,
          dockId: dock._id,
          ...(guildIds ? { guildIds } : {}),
          components,
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        })
        .catch((error) => console.error("[dock-ban] Failed to relay ban alert:", error)),
    ),
  );
}

async function banFollower(interaction, followerGuildId, reason) {
  const target = await getBanTarget(interaction, followerGuildId);
  if (!target) return;

  const cleanReason = reason.trim();
  if (!cleanReason) {
    return interaction.reply({
      content: "A ban reason is required.",
      flags: MessageFlags.Ephemeral,
    });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const escapedPublisherName = interaction.client.modules.escapeMarkdown(
    target.ownerGuildName ?? target.ownerGuildId,
  );
  const escapedFollowerName = interaction.client.modules.escapeMarkdown(
    target.follower.guildName ?? target.follower.guildId,
  );
  const components = [
    new ContainerBuilder().addTextDisplayComponents((text) =>
      text.setContent(
        `### 🔨 Server banned\n**${escapedFollowerName}** was banned from following Docks published by **${escapedPublisherName}**.\n\n**Reason:** ${interaction.client.modules.escapeMarkdown(cleanReason)}\n**Moderator:** ${interaction.user.username}`,
      ),
    ),
  ];
  await relayServerBanAlert(interaction, components);

  const bannedAt = new Date();
  const banFields = {
    ownerGuildName: target.ownerGuildName,
    targetGuildName: target.follower.guildName,
    reason: cleanReason,
    bannedAt,
    bannedByUserId: interaction.user.id,
  };

  await interaction.client.modules.db.setDockServerBan(
    target.ownerGuildId,
    target.follower.guildId,
    banFields,
  );
  await interaction.client.modules.db.banDockFollow(
    target.ownerGuildId,
    target.follower.guildId,
    {
      guildName: target.follower.guildName,
      banReason: cleanReason,
      bannedAt,
      bannedByUserId: interaction.user.id,
    },
  );

  await interaction.deleteReply().catch(() => null);
}

async function unbanFollower(interaction, followerGuildId) {
  const target = await getUnbanTarget(interaction, followerGuildId);
  if (!target) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const escapedPublisherName = interaction.client.modules.escapeMarkdown(
    target.ownerGuildName ?? target.ownerGuildId,
  );
  const escapedFollowerName = interaction.client.modules.escapeMarkdown(
    target.follower.guildName ?? target.follower.guildId,
  );

  const components = [
    new ContainerBuilder().addTextDisplayComponents((text) =>
      text.setContent(
        `### ✅ Server unbanned\n**${escapedFollowerName}** was unbanned from following Docks published by **${escapedPublisherName}**.`,
      ),
    ),
  ];
  await relayServerBanAlert(interaction, components, [interaction.guildId, target.follower.guildId]);

  await interaction.client.modules.db.removeDockServerBan(target.ownerGuildId, followerGuildId);
  await interaction.client.modules.db.unbanDockFollow(
    target.ownerGuildId,
    followerGuildId,
  );
  return interaction.deleteReply().catch(() => null);
}

module.exports = { banFollower, unbanFollower };
