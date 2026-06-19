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

module.exports = async function dockPublishModal(
  interaction,
  defaults = {},
  customId = "dock-publish-modal",
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
      .setTitle("Publish a Dock")
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Dock Name")
          .setDescription("Name of this specific Dock")
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
        new LabelBuilder().setLabel("Dock Description").setTextInputComponent(
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
            "Whenever one of these keywords is included in a message, Dock followers will be pinged",
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
          .setLabel("Dock Visibility")
          .setDescription("Who can follow your Dock, and what messages get forwarded")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder().setCustomId("dock-visibility").addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("Open - All messages")
                .setValue("open-all")
                .setDefault(`${defaults.accessMode}-${defaults.publishMode}` === "open-all"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Open - Manual with !p")
                .setValue("open-manual")
                .setDefault(`${defaults.accessMode}-${defaults.publishMode}` === "open-manual"),

              new StringSelectMenuOptionBuilder()
                .setLabel("Request To Join - All messages")
                .setValue("request-all")
                .setDefault(`${defaults.accessMode}-${defaults.publishMode}` === "request-all"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Request To Join - Manual with !p")
                .setValue("request-manual")
                .setDefault(
                  `${defaults.accessMode}-${defaults.publishMode}` === "request-manual",
                ),
            ),
          ),
      ),
  );
};
