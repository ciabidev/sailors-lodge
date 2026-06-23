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
    .setDescription("Ban a server from following this server's Docks.")
    .addStringOption((option) =>
      option
        .setName("follower")
        .setDescription("The server to ban.")
        .setAutocomplete(true)
        .setRequired(true),
    ),

  async autocomplete(interaction) {
    return interaction.client.modules.dockModerationAutocomplete.followers(interaction, false);
  },

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Dock server bans can only be managed from a Discord server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You don't have permission to ban servers from Docks (`Manage Channels`).",
        flags: MessageFlags.Ephemeral,
      });
    }

    const followerGuildInput = interaction.options.getString("follower", true);
    const followerGuild =
      interaction.client.guilds.cache.get(followerGuildInput) ??
      interaction.client.guilds.cache.find(
        (guild) => guild.name.toLowerCase() === followerGuildInput.toLowerCase(),
      );
    const followerGuildId = followerGuild?.id ?? followerGuildInput;

    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(`dock-ban-modal:${followerGuildId}`)
        .setTitle("Ban Server From Docks")
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
