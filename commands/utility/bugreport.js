const {
  LabelBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

function buildBugReportModal(associatedEventId = "") {
  const errorIdInput = new TextInputBuilder()
    .setCustomId("error_id")
    .setStyle(TextInputStyle.Short)
    .setMinLength(32)
    .setMaxLength(32)
    .setRequired(false);

  if (associatedEventId) errorIdInput.setValue(associatedEventId);

  return new ModalBuilder()
    .setCustomId(`bug-report-modal${associatedEventId ? `:${associatedEventId}` : ""}`)
    .setTitle("Report a Bug")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("What were you trying to do?")
        .setDescription("Briefly describe the action or command you were using.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("goal")
            .setStyle(TextInputStyle.Short)
            .setMinLength(5)
            .setMaxLength(200)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("What went wrong?")
        .setDescription("Include what you expected and what happened instead.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("description")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(2000)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Steps to reproduce")
        .setDescription("[Optional]: tell us how to make the problem happen again.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("steps")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false),
        ),
      new LabelBuilder()
        .setLabel("Error ID")
        .setDescription("[Optional]: Paste the ID shown in the bot's error notice.")
        .setTextInputComponent(errorIdInput),
      new LabelBuilder()
        .setLabel("Discord username")
        .setDescription("[Optional]: if you want us to get back to you.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("contact_name")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(false),
        ),
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bugreport")
    .setDescription("Report a bug to the Sailor's Lodge developers."),

  async execute(interaction) {
    return interaction.showModal(buildBugReportModal());
  },

  buildBugReportModal,
};
