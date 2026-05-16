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

module.exports = async function partyConfigModal(interaction, defaults = {}, customId = "party-modal") { // Defaults are usually set from previous party configs, not exactly hardcoded.
    const defaultStatus = defaults.status ?? "not-started";

    interaction.showModal(
      new ModalBuilder()
        .setCustomId(customId)
        .setTitle("Configure your party") // 
        .addLabelComponents(
          new LabelBuilder().setLabel("Party Name").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("name")
              .setStyle(TextInputStyle.Short)
              .setValue(defaults.name ?? `${interaction.user.username}'s party`)
              .setMaxLength(150)
            )
        )
        .addLabelComponents(
          new LabelBuilder().setLabel("Status")
              .setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                  .setCustomId("status")
                  .addOptions(
                    new StringSelectMenuOptionBuilder()
                      .setLabel("Not Started")
                      .setEmoji("⏳")
                      .setValue("not-started")
                      .setDefault(defaultStatus === "not-started"),
                    new StringSelectMenuOptionBuilder()
                      .setLabel("Starting")
                      .setEmoji("🔥")
                      .setValue("starting")
                      .setDefault(defaultStatus === "starting"),
                    new StringSelectMenuOptionBuilder()
                      .setLabel("Active")
                      .setEmoji("☑️")
                      .setValue("active")
                      .setDescription("Note: Choosing this setting will hide the party from Browse")
                      .setDefault(defaultStatus === "active")
                  )
              )
              
        )
        .addLabelComponents(
          new LabelBuilder().setLabel("Description").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("description")
              .setStyle(TextInputStyle.Paragraph)
              .setValue(defaults.description ?? "")
              .setMaxLength(500)
              .setRequired(false)
          )
        )
        
        .addLabelComponents(
          new LabelBuilder().setLabel("Member Limit").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("limit")
              .setStyle(TextInputStyle.Short)
              .setValue(String(defaults.limit ?? 10))
              .setMaxLength(3)
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

