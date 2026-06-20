const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } = require("discord.js");

async function addDisplayData(client, dock) {
  const guild = dock.guildId ? await client.guilds.fetch(dock.guildId).catch(() => null) : null;

  return {
    ...dock,
    guildName: guild?.name ?? dock.guildName ?? dock.guildId ?? "Unknown publisher",
    guildIconURL: guild?.iconURL({ extension: "png", size: 64 }),
  };
}

async function matchesSearch(client, search, dock) {
  if (!search) return true;

  const channels = await Promise.all(
    (dock.channelIds ?? []).map((channelId) => client.channels.fetch(channelId).catch(() => null)),
  );
  return [dock.name, dock.description, dock.guildName, ...channels.map((channel) => channel?.name)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(search));
}

module.exports = async function dockManagePage({ client, state }) {
  let followedDocks = await client.modules.db.getFollowedDocksForGuild(state.guildId);
  let publishedDocks = await client.modules.db.getPublishedDocksForGuild(state.guildId);

  followedDocks = followedDocks.filter((dock) => dock.guildId !== state.guildId); // every publisher auto follows their own docks so we have to filter the self-follows out
  followedDocks = await Promise.all(followedDocks.map((dock) => addDisplayData(client, dock)));
  publishedDocks = await Promise.all(publishedDocks.map((dock) => addDisplayData(client, dock)));

  const followedMatches = await Promise.all(
    followedDocks.map((dock) => matchesSearch(client, state.search, dock)),
  );
  const publishedMatches = await Promise.all(
    publishedDocks.map((dock) => matchesSearch(client, state.search, dock)),
  );
  followedDocks = followedDocks.filter((_, index) => followedMatches[index]);
  publishedDocks = publishedDocks.filter((_, index) => publishedMatches[index]);

  const pages = {
    published: client.modules.chunkArray(publishedDocks, 3),
    following: client.modules.chunkArray(followedDocks, 3),
  };
  if (!state.mode) state.mode = pages.published.length ? "published" : "following";

  const currentPages = pages[state.mode] ?? [];
  state.pageIndex = Math.min(
    Math.max(state.pageIndex ?? 0, 0),
    Math.max(currentPages.length - 1, 0),
  );
  state.pageCount = currentPages.length;

  const title =
    state.mode === "published" ? "👑 Manage Published Docks" : "🌐 Manage Followed Docks";
  const container = new ContainerBuilder().addTextDisplayComponents((text) =>
    text.setContent(
      `## ${title} (Page ${state.pageIndex + 1}/${Math.max(currentPages.length, 1)})`,
    ),
  );

  for (const dock of currentPages[state.pageIndex] ?? []) {
    const fromThisGuild = dock.guildId === state.guildId;
    const follower = fromThisGuild
      ? null
      : await client.modules.db.getDockFollower(dock._id, state.guildId);
    const canManageFollowers =
      fromThisGuild || client.modules.dockLevels.canManage(follower?.level);
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`dock-configure-${fromThisGuild ? "owner" : "follower"}:${dock._id}`)
        .setLabel("Configure")
        .setStyle(ButtonStyle.Secondary),
    ];

    if (fromThisGuild) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`dock-home-ping-roles:${dock._id}`)
          .setLabel("Home Ping Roles")
          .setStyle(ButtonStyle.Secondary),
      );
      
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`dock-manage-followers:${dock._id}`)
          .setLabel("Manage Followers")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`dock-delete:${dock._id}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger),
      );
    } else {
      if (canManageFollowers) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`dock-manage-followers:${dock._id}`)
            .setLabel("Manage Followers")
            .setStyle(ButtonStyle.Secondary),
        );
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`dock-unfollow:${dock._id}`)
          .setLabel("Unfollow")
          .setStyle(ButtonStyle.Danger),
      );
    }

    await client.modules.getDockDisplay(container, dock, buttons, client);
  }

  if (!currentPages.length) {
    container.addTextDisplayComponents((text) =>
      text.setContent(
        state.mode === "published"
          ? "This server doesn't have any published Docks yet. Publish a dock with `/dock publish`."
          : "This server doesn't follow any Docks yet. Discover docks with `/dock browse`.",
      ),
    );
  }

  const modeSelector = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("docks-manage-mode:published")
      .setLabel("Manage Published")
      .setEmoji("👑")
      .setStyle(state.mode === "published" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("docks-manage-mode:following")
      .setLabel("Manage Followed")
      .setEmoji("🌐")
      .setStyle(state.mode === "following" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
  const pageSelector = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("docks-manage-prev")
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPages.length <= 1),
    new ButtonBuilder()
      .setCustomId("docks-manage-next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPages.length <= 1),
  );

  return {
    components: [container, modeSelector, pageSelector],
    hasDocks: publishedDocks.length > 0 || followedDocks.length > 0,
  };
};
