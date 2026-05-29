const { MessageFlags, SlashCommandSubcommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("edit")
    .setDescription("Edit an existing feed.")
    .addStringOption((option) =>
        option.setName("feed").setDescription("The feed to edit.").setRequired(true).setAutocomplete(true),
      ),
  async autocomplete(interaction) {
    const feeds = await interaction.client.modules.db.getFeedSources();
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = feeds
      .filter((feed) => feed.guildId === interaction.guildId)
      .filter((feed) => !focused || (feed.name ?? "").toLowerCase().includes(focused))
      .slice(0, 25)
      .map((feed) => ({
        name: (feed.name ?? "Untitled Feed").slice(0, 100),
        value: feed._id.toString(),
      }));

    return interaction.respond(choices);
  },
  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Feeds can only be edited from a server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedFeed = interaction.options.getString("feed", true);
    const feeds = await interaction.client.modules.db.getFeedSources();
    const feed = feeds.find(
      (source) =>
        source.guildId === interaction.guildId &&
        (source._id.toString() === selectedFeed || source.name === selectedFeed),
    );

    if (!feed) {
      return interaction.reply({
        content: "I couldn't find that feed in this server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.client.modules.feedPublishModal(
      interaction,
      feed,
      `feed-publish-modal:${feed._id}`,
    );
  },
};
