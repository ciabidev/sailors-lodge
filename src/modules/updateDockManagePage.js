const { MessageFlags } = require("discord.js");

const { managePages: dockManagePages } = require("../../commands/dock/manage");

module.exports = async function updateDockManagePage(interaction, options = {}) {
  const state = dockManagePages.get(interaction.user.id);
  if (!state) {
    await interaction.reply({
      content: "This Dock management session has expired. Run `/dock manage` again.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  const { mode, resetPage = mode !== undefined, pageIndex } = options;
  if (mode === "published" || mode === "following") state.mode = mode;
  if (pageIndex !== undefined) state.pageIndex = pageIndex;
  if (resetPage) state.pageIndex = 0;
  delete state.followerManager;

  const view = await interaction.client.modules.dockManagePage({
    client: interaction.client,
    state,
  });
  await interaction.update({ components: view.components });

  return true;
};
