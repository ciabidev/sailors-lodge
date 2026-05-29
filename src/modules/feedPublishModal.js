const {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = async function feedPublishModal(
  interaction,
  defaults = {},
  customId = "feed-publish-modal",
) {
  const channelsSelect = new ChannelSelectMenuBuilder()
    .setCustomId("channels")
    .setPlaceholder("Example: #luck-parties, #another-luck-parties")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(1)
    .setMaxValues(10);

  if (defaults.channelIds?.length) {
    channelsSelect.setDefaultChannels(defaults.channelIds.slice(0, 10));
  }

  return interaction.showModal(
    new ModalBuilder()
      .setCustomId(customId)
      .setTitle("Publish a Feed")
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Feed Name")
          .setDescription("Name of this specific feed")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("name")
              .setStyle(TextInputStyle.Short)
              .setValue(defaults.name ?? "")
              .setPlaceholder("Party Central (Luck Parties)")
              .setMaxLength(150),
          ),
      )
      .addLabelComponents(
        new LabelBuilder().setLabel("Channel(s)").setChannelSelectMenuComponent(channelsSelect),
      )
      .addLabelComponents(
        new LabelBuilder().setLabel("Feed Description").setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("description")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(defaults.description ?? "")
            .setMaxLength(500)
            .setRequired(false),
        ),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Ping Keywords")
          .setDescription(
            "Whenever one of these keywords is included in a message, subscribers will be pinged",
          )
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("keywords")
              .setStyle(TextInputStyle.Paragraph)
              .setValue((defaults.keywords ?? []).join("\n"))
              .setPlaceholder("Keyword 1\nKeyword 2\nKeyword 3")
              .setRequired(false)
              .setMaxLength(500),
          ),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Feed Visibility")
          .setDescription("Who can subscribe to your feed, and what messages get forwarded")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder().setCustomId("feed-visibility").addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("Open - All messages")
                .setValue("open-all")
                .setDefault(`${defaults.subscriptionMode}-${defaults.publishMode}` === "open-all"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Open - Keywords only")
                .setValue("open-keywords")
                .setDefault(
                  `${defaults.subscriptionMode}-${defaults.publishMode}` === "open-keywords",
                ),

              new StringSelectMenuOptionBuilder()
                .setLabel("Request To Join - All messages")
                .setValue("request-all")
                .setDefault(`${defaults.subscriptionMode}-${defaults.publishMode}` === "request-all"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Request To Join - Keywords only")
                .setValue("request-keywords")
                .setDefault(
                  `${defaults.subscriptionMode}-${defaults.publishMode}` === "request-keywords",
                ),
            ),
          ),
      ),
  );
};
