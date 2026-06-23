const {
  Collection,
  MessageFlags,
  PermissionFlagsBits,
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
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Docks can only be managed from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You don't have permission to manage this server's docks (`Manage Channels`)",
        flags: MessageFlags.Ephemeral,
      });
    }

    const state = {
      pageIndex: 0,
      mode: null,
      guildId: interaction.guildId,
      search: interaction.options.getString("search")?.toLowerCase(),
    };
    const view = await interaction.client.modules.dockManagePage({
      client: interaction.client,
      state,
    });

    if (!view.hasDocks) {
      return interaction.reply({
        content: state.search
          ? "No docks matched that search"
          : "This server isn't following or publishing any docks. Follow one with `/dock browse` or create your own with `/dock publish`!",
        flags: MessageFlags.Ephemeral,
      });
    }

    managePages.set(interaction.user.id, state);
    return interaction.reply({
      components: view.components,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};
