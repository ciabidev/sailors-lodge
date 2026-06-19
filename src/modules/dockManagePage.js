const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = function dockManagePage({ pages, pageIndex, mode, guildId, client }) {
  const page = pages[pageIndex] ?? [];
  const title = mode === "published" ? "👑 Manage Published Docks" : "🌐 Manage Followed Docks";
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## ${title} (Page ${pageIndex + 1}/${Math.max(pages.length, 1)})`),
  );

  for (const dock of page) {
    const fromThisGuild = dock.guildId === guildId;

    const button1 = new ButtonBuilder()
      .setCustomId(`dock-configure-${fromThisGuild ? "owner" : "follower"}:${dock._id}`)
      .setLabel("Configure")
      .setStyle(ButtonStyle.Secondary);
    
    client.modules.getDockDisplay(container, dock, [button1], client); // container gets mutated directly in the function thats how its possible for this to work lol
  }

  return container;
};
