async function getManageableDocks(client, guildId) {
  const publishedDocks = await client.modules.db.getPublishedDocksForGuild(guildId);
  const followedDocks = await client.modules.db.getFollowedDocksForGuild(guildId);
  const adminDocks = [];

  for (const dock of followedDocks.filter((dock) => dock.guildId !== guildId)) {
    const follower = await client.modules.db.getDockFollower(dock._id, guildId);
    if (
      client.modules.dockLevels.canRead(follower) &&
      client.modules.dockLevels.canManage(follower.level)
    ) adminDocks.push(dock);
  }

  return [...publishedDocks, ...adminDocks];
}

function matchesSearch(value, search) {
  return value?.toLowerCase().includes(search) ?? false;
}

function getBanCandidates(client, dockFollowers, serverBans, managingGuildId, search) {
  const followerGuildIds = new Set(dockFollowers.map((follower) => follower.guildId));
  const bannedGuildIds = new Set(serverBans.map((ban) => ban.targetGuildId));
  const existingFollowersByGuildId = new Map();

  for (const follower of dockFollowers) {
    if (follower.guildId === managingGuildId || bannedGuildIds.has(follower.guildId)) continue;
    if (!existingFollowersByGuildId.has(follower.guildId)) {
      existingFollowersByGuildId.set(follower.guildId, {
        name: follower.guildName ?? follower.guildId,
        value: follower.guildId,
      });
    }
  }

  const visibleGuilds = client.guilds.cache
    .filter(
      (guild) =>
        guild.id !== managingGuildId &&
        !followerGuildIds.has(guild.id) &&
        !bannedGuildIds.has(guild.id),
    )
    .map((guild) => ({
      name: `${guild.name} (not following)`,
      value: guild.id,
    }));

  return [...existingFollowersByGuildId.values(), ...visibleGuilds].filter((candidate) =>
    matchesSearch(candidate.name, search) || matchesSearch(candidate.value, search),
  );
}

async function docks(interaction) {
  const search = interaction.options.getFocused().trim().toLowerCase();
  const manageableDocks = await getManageableDocks(interaction.client, interaction.guildId);

  return interaction.respond(
    manageableDocks
      .filter((dock) =>
        matchesSearch(dock.name, search) || matchesSearch(dock.guildName, search),
      )
      .slice(0, 25)
      .map((dock) => ({
        name: `${dock.name} — ${dock.guildName}`.slice(0, 100),
        value: dock._id.toString(),
      })),
  );
}

async function followers(interaction, banned) {
  const search = interaction.options.getFocused().trim().toLowerCase();
  const ownerDocks = await interaction.client.modules.db.getPublishedDocksForGuild(
    interaction.guildId,
  );
  const dockFollowers = ownerDocks.length
    ? await interaction.client.modules.db.getManyDockFollowers(
        ownerDocks.map((dock) => dock._id),
      )
    : [];
  const serverBans = await interaction.client.modules.db.getDockServerBans(interaction.guildId);
  const candidates = banned
    ? serverBans
        .filter((ban) => ban.targetGuildId !== interaction.guildId)
        .map((ban) => ({
          name: ban.targetGuildName ?? ban.targetGuildId,
          value: ban.targetGuildId,
        }))
    : getBanCandidates(
        interaction.client,
        dockFollowers,
        serverBans,
        interaction.guildId,
        search,
      );

  return interaction.respond(
    candidates
      .filter((candidate) =>
        matchesSearch(candidate.name, search) || matchesSearch(candidate.value, search),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 25)
      .map((candidate) => ({
        name: candidate.name.slice(0, 100),
        value: candidate.value,
      })),
  );
}

module.exports = { docks, followers };
