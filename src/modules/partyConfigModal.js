const {
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require("discord.js");

module.exports = async function partyConfigModal(interaction, defaults = {}) {
    interaction.showModal(
      new ModalBuilder()
        .setCustomId("party-modal")
        .setTitle("Party Creation") // 
        .addLabelComponents(
          new LabelBuilder().setLabel("Party Name").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("name")
              .setStyle(TextInputStyle.Short)
              .setValue(defaults.name ?? `${interaction.user.username}'s party`)
          )
        )
        .addLabelComponents(
          new LabelBuilder().setLabel("Description").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("description")
              .setStyle(TextInputStyle.Paragraph)
              .setValue(defaults.description ?? "")
              .setRequired(false)
          )
        )
        .addLabelComponents(
          new LabelBuilder().setLabel("Member Limit").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("limit")
              .setStyle(TextInputStyle.Short)
              .setValue(String(defaults.limit ?? 10))
          )
        )
        .addLabelComponents(
          new LabelBuilder().setLabel("Visibility").setStringSelectMenuComponent(
            new StringSelectMenuBuilder().setCustomId("visibility").addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("Public")
                .setValue("public")
                .setDefault(defaults.visibility !== "private"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Private")
                .setValue("private")
                .setDefault(defaults.visibility === "private")
            )
          )
        )
    );
};

