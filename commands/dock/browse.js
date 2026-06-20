const {
  Collection,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} = require("discord.js");

const browsePages = new Collection();

module.exports = {
  browsePages,

  data: new SlashCommandSubcommandBuilder()
    .setName("browse")
    .setDescription("Browse available Docks.")
    .addStringOption((option) =>
      option.setName("search").setDescription("Search Docks by name, publisher, or channel."),
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You don't have permission to follow Docks (`Manage Channels`)",
        flags: MessageFlags.Ephemeral,
      });
    }

    const state = {
      pageIndex: 0,
      pageCount: 0,
      search: interaction.options.getString("search")?.trim().toLowerCase() ?? "",
    };
    const view = await interaction.client.modules.dockBrowsePage({
      client: interaction.client,
      state,
    });

    if (!view.hasDocks) {
      return interaction.reply({
        content: state.search ? "No Docks matched that search." : "No Docks are published yet.",
        flags: MessageFlags.Ephemeral,
      });
    }

    browsePages.set(interaction.user.id, state);
    return interaction.reply({
      components: view.components,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};
