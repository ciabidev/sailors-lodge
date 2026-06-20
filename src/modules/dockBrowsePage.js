const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = async function dockBrowsePage({ pages, pageIndex, client }) {
  const page = pages[pageIndex] ?? [];
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## Browse Docks (Page ${pageIndex + 1}/${pages.length})`),
  );

  for (const dock of page) {
    const followButton = new ButtonBuilder()
      .setCustomId(`dock-follow:${dock._id}`)
      .setLabel(dock.accessMode === "request" ? "Request To Follow" : "Follow")
      .setStyle(ButtonStyle.Success);

    await client.modules.getDockDisplay(container, dock, [followButton], client);
  }

  return container;
};
