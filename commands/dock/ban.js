const {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("ban")
    .setDescription("Ban a server from following a Dock.")
    .addStringOption((option) =>
      option
        .setName("dock")
        .setDescription("The Dock to manage.")
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("follower")
        .setDescription("The follower server to ban.")
        .setAutocomplete(true)
        .setRequired(true),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "dock") {
      return interaction.client.modules.dockModerationAutocomplete.docks(interaction);
    }
    return interaction.client.modules.dockModerationAutocomplete.followers(interaction, false);
  },

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Dock followers can only be banned from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You don't have permission to ban Dock followers (`Manage Channels`).",
        flags: MessageFlags.Ephemeral,
      });
    }

    const dockId = interaction.options.getString("dock", true);
    const followerGuildInput = interaction.options.getString("follower", true);
    const followerGuild =
      interaction.client.guilds.cache.get(followerGuildInput) ??
      interaction.client.guilds.cache.find(
        (guild) => guild.name.toLowerCase() === followerGuildInput.toLowerCase(),
      );
    const followerGuildId = followerGuild?.id ?? followerGuildInput;

    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(`dock-ban-modal:${dockId}:${followerGuildId}`)
        .setTitle("Ban Dock Follower")
        .addLabelComponents(
          new LabelBuilder()
            .setLabel("Reason")
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId("reason")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(true),
            ),
        ),
    );
  },
};
