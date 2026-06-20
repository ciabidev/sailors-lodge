const {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = async function dockDefaultLevelModal(
  interaction,
  dockId,
  defaults = {},
  customId = "dock-default-level",
) {
  interaction.showModal(
    new ModalBuilder()
      .setTitle("Modal")
      .setCustomId(`${customId}:${dockId}`)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "# Set a Default permission level for followers\nAny follower who joins will be assigned the Default level until you promote them manually",
        ),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Set Default Level")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("level")
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel("Passive")
                  .setValue("passive")
                  .setDescription("Followers can only read messages from dock senders")
                  .setEmoji("📥"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("Contributor")
                  .setValue("contributor")
                  .setDescription(
                    "Followers can send messages through the rest of the dock to other followers and",
                  )
                  .setEmoji("📤"),
              ),
          ),
      ),
  );
};
