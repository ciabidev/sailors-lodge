const { MessageFlags } = require("discord.js");

const { browsePages: dockBrowsePages } = require("../../commands/dock/browse");

module.exports = async function updateDockBrowsePage(interaction, options = {}) {
  const state = dockBrowsePages.get(interaction.user.id);
  if (!state) {
    await interaction.reply({
      content: "This Dock browsing session has expired. Run `/dock browse` again.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (options.search !== undefined) {
    state.search = options.search.trim().toLowerCase();
    state.pageIndex = 0;
  }
  if (options.pageIndex !== undefined) state.pageIndex = options.pageIndex;

  const view = await interaction.client.modules.dockBrowsePage({
    client: interaction.client,
    state,
  });
  await interaction.update({ components: view.components });

  return true;
};
