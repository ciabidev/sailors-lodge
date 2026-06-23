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

function getBanCandidates(client, dock, dockFollowers, managingGuildId, search) {
  const followerGuildIds = new Set(dockFollowers.map((follower) => follower.guildId));
  const existingFollowers = dockFollowers
    .filter(
      (follower) =>
        follower.guildId !== dock.guildId &&
        follower.guildId !== managingGuildId &&
        follower.banned !== true,
    )
    .map((follower) => ({
      name: follower.guildName ?? follower.guildId,
      value: follower.guildId,
    }));

  const visibleGuilds = client.guilds.cache
    .filter(
      (guild) =>
        guild.id !== dock.guildId &&
        guild.id !== managingGuildId &&
        !followerGuildIds.has(guild.id),
    )
    .map((guild) => ({
      name: `${guild.name} (not following)`,
      value: guild.id,
    }));

  return [...existingFollowers, ...visibleGuilds].filter((candidate) =>
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
  const dockId = interaction.options.getString("dock");
  if (!dockId) return interaction.respond([]);

  const manageableDocks = await getManageableDocks(interaction.client, interaction.guildId);
  const dock = manageableDocks.find((dock) => dock._id.toString() === dockId);
  if (!dock) return interaction.respond([]);

  const search = interaction.options.getFocused().trim().toLowerCase();
  const dockFollowers = await interaction.client.modules.db.getDockFollowers(dock._id);
  const candidates = banned
    ? dockFollowers
        .filter(
          (follower) =>
            follower.guildId !== dock.guildId &&
            follower.guildId !== interaction.guildId &&
            follower.banned === true,
        )
        .map((follower) => ({
          name: follower.guildName ?? follower.guildId,
          value: follower.guildId,
        }))
    : getBanCandidates(
        interaction.client,
        dock,
        dockFollowers,
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
