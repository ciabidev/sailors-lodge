const {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = async function feedPublishModal(interaction) {
  return interaction.showModal(
    new ModalBuilder()
      .setCustomId("feed-publish-modal")
      .setTitle("Publish a Feed")
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Feed Name")
          .setDescription("Name of this specific feed")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("name")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("Party Central (Luck Parties)")
              .setMaxLength(150),
          ),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Channel(s)")
          .setChannelSelectMenuComponent(
            new ChannelSelectMenuBuilder()
              .setCustomId("channels")
              .setPlaceholder("Example: #luck-parties, #another-luck-parties")
              .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
              .setMinValues(1)
              .setMaxValues(10),
          ),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Feed Description")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("description")
              .setStyle(TextInputStyle.Paragraph)
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
              .setPlaceholder("Keyword 1\nKeyword 2\nKeyword 3")
              .setRequired(false)
              .setMaxLength(500),
          ),
      ),
  );
};
