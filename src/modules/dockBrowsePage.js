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
  if (!search?.trim()) return true;

  const channels = await Promise.all(
    (dock.channelIds ?? []).map((channelId) => client.channels.fetch(channelId).catch(() => null)),
  );
  return client.modules.matchesSearch(search, [
    dock.name,
    dock.description,
    dock.guildName,
    channels.map((channel) => channel?.name),
  ]);
}

module.exports = async function dockBrowsePage({ client, state }) {
  let docks = await client.modules.db.getDocks();
  docks = await Promise.all(docks.map((dock) => addDisplayData(client, dock)));

  const matches = await Promise.all(
    docks.map((dock) => matchesSearch(client, state.search, dock)),
  );
  docks = docks.filter((_, index) => matches[index]);

  const pages = client.modules.chunkArray(docks, 3);
  state.pageIndex = Math.min(
    Math.max(state.pageIndex ?? 0, 0),
    Math.max(pages.length - 1, 0),
  );
  state.pageCount = pages.length;

  const searchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("docks-browse-search")
      .setLabel(state.search ? `Search: ${state.search.slice(0, 65)}` : "Search Docks")
      .setEmoji("🔎")
      .setStyle(ButtonStyle.Secondary),
  );
  if (state.search) {
    searchRow.addComponents(
      new ButtonBuilder()
        .setCustomId("docks-browse-search-clear")
        .setLabel("Clear")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  const container = new ContainerBuilder().addTextDisplayComponents((text) =>
    text.setContent(
      `## Browse Docks${state.search ? `\n-# Results for **${client.modules.escapeMarkdown(state.search)}**` : ""}`,
    ),
  );
  const DEV_IDS = (process.env.DEV_IDS ?? "").split(",").map((id) => id.trim());

  const page = pages[state.pageIndex] ?? [];
  for (const [index, dock] of page.entries()) {
    const follower = await client.modules.db.getDockFollower(dock._id, state.guildId);
    const serverBan = await client.modules.db.getDockServerBan(dock.guildId, state.guildId);
    const publishedHere = dock.guildId === state.guildId;
    const isBanned = follower?.banned === true || Boolean(serverBan);
    const isPending = follower?.level === "no-access" && !isBanned;
    const isFollowing = client.modules.dockLevels.canRead(follower);

    let followLabel = "Follow";

    if (publishedHere) followLabel = "Published Here";
    else if (isBanned) followLabel = "Follow?";
    else if (isPending) followLabel = "Request Pending";
    else if (isFollowing) followLabel = "Following";
    else if (dock.accessMode === "request") followLabel = "Request To Follow";

    const followButton = new ButtonBuilder()
      .setCustomId(`dock-follow:${dock._id}`)
      .setLabel(followLabel)
      .setStyle(
        publishedHere || isPending || isFollowing
          ? ButtonStyle.Secondary
          : ButtonStyle.Success,
      )
      .setDisabled(publishedHere || isPending || isFollowing);
    let devButtons = []
    if (DEV_IDS.includes(state.userId)) {
      devButtons = [
        new ButtonBuilder()
          .setCustomId(`dock-official:${dock._id}`)
          .setLabel("Make Official")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`dock-delete:${dock._id}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Danger),
      ]
    }
    await client.modules.getDockDisplay(container, dock, [followButton, ...devButtons], client, {
      hideSeparator: index === page.length - 1,
    });
  }

  if (!docks.length) {
    container.addTextDisplayComponents((text) =>
      text.setContent(state.search ? "No Docks matched that search." : "No Docks are published yet."),
    );
  }

  const pageSelector = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("docks-prev")
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pages.length <= 1),
    new ButtonBuilder()
      .setCustomId("docks-page-position")
      .setLabel(`${state.pageIndex + 1} / ${Math.max(pages.length, 1)}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("docks-next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pages.length <= 1),
  );

  return {
    components: [searchRow, container, pageSelector],
    hasDocks: docks.length > 0,
  };
};
