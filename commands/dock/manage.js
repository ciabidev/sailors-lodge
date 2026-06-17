const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  MessageFlags,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

const managePages = new Collection();

module.exports = {
  managePages,

  data: new SlashCommandSubcommandBuilder()
    .setName("manage")
    .setDescription("Manage Docks this server is following or publishing")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search docks by name"),
    ),
  async execute(interaction) {
    async function getDockLabels(dock) {
      const guild = dock.guildId
        ? await interaction.client.guilds.fetch(dock.guildId).catch(() => null)
        : null;

      const channelIds = dock.channelIds ?? [];
      const channels = await Promise.all(
        channelIds.map((channelId) =>
          interaction.client.channels.fetch(channelId).catch(() => null),
        ),
      );
      const channelNames = channels.map((channel, index) => {
        if (channel?.name) return `#${channel.name}`;
        return `#${channelIds[index]}`;
      });

      return {
        ...dock,
        guildName: guild?.name ?? dock.guildId ?? "Unknown publisher",
        channelIds,
        channelNames,
        guildIconURL: guild?.iconURL({ extension: "png", size: 64 }),
      };
    }

    const db = interaction.client.modules.db;
    const search = interaction.options.getString("search")?.toLowerCase();

    let followedDocks = await db.getFollowedDocksForGuild(interaction.guildId);
    let publishedDocks = await db.getPublishedDocksForGuild(interaction.guildId);

    followedDocks = followedDocks.filter((dock) => dock.guildId !== interaction.guildId);
    followedDocks = await Promise.all(followedDocks.map((dock) => getDockLabels(dock)));
    publishedDocks = await Promise.all(publishedDocks.map((dock) => getDockLabels(dock)));

    if (search) {
      followedDocks = followedDocks.filter((dock) =>
        [dock.name, dock.description, dock.guildName, ...(dock.channelNames ?? [])]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search)),
      );
      publishedDocks = publishedDocks.filter((dock) =>
        [dock.name, dock.description, dock.guildName, ...(dock.channelNames ?? [])]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(search)),
      );
    }

    if (!publishedDocks.length && !followedDocks.length) {
      return interaction.reply({
        content: search ? "No docks matched that search" : "This server isn't following or publishing any docks. Follow one with `/dock browse` or create your own with `/dock publish`!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = {
      published: interaction.client.modules.chunkArray(publishedDocks, 3),
      following: interaction.client.modules.chunkArray(followedDocks, 3),
    };
    const state = {
      pages,
      pageIndex: 0,
      mode: publishedDocks.length ? "published" : "following",
      guildId: interaction.guildId,
    };
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
        .setDisabled(pages[state.mode].length <= 1),
      new ButtonBuilder()
        .setCustomId("docks-manage-next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pages[state.mode].length <= 1),
    );

    managePages.set(interaction.user.id, state);

    await interaction.reply({ // The actual management logic will be handled in interactionCreate
      components: [
        interaction.client.modules.dockManagePage({
          pages: pages[state.mode],
          pageIndex: state.pageIndex,
          mode: state.mode,
          guildId: interaction.guildId,
          client: interaction.client,
        }),
        modeSelector,
        pageSelector,
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};
