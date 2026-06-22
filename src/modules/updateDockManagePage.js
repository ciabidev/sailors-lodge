const { MessageFlags, DiscordAPIError } = require("discord.js");

const { managePages: dockManagePages } = require("../../commands/dock/manage");

module.exports = async function updateDockManagePage(interaction, options = {}) {
  try {
    const state = dockManagePages.get(interaction.user.id);

    if (!state) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "This Dock management session has expired. Run `/dock manage` again.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return false;
    }

    // Acknowledge immediately to avoid 3-second timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const { mode, resetPage = mode !== undefined, pageIndex } = options;

    if (mode === "published" || mode === "following") state.mode = mode;

    if (options.search !== undefined) {
      state.search = options.search.trim().toLowerCase();
      state.pageIndex = 0;
    }

    if (pageIndex !== undefined) state.pageIndex = pageIndex;
    if (resetPage) state.pageIndex = 0;

    delete state.followerManager;

    const view = await interaction.client.modules.dockManagePage({
      client: interaction.client,
      state,
    });

    await interaction.editReply({
      components: view.components,
    });

    return true;
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      (error.code === 10062 || error.code === 40060)
    ) {
      return false;
    }

    throw error;
  }
};