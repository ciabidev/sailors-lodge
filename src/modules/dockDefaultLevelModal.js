const {
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = async function dockDefaultLevelModal(interaction, dockId, currentLevel) {
  const dockLevels = interaction.client.modules.dockLevels;
  const levelSelect = new StringSelectMenuBuilder()
    .setCustomId("level")
    .addOptions(
      dockLevels.order.map((level) => {
        const details = dockLevels.get(level);
        return {
          label: details.label,
          value: level,
          description: details.description,
          emoji: details.emoji,
          default: level === dockLevels.normalize(currentLevel),
        };
      }),
    );

  return interaction.showModal(
    new ModalBuilder()
      .setTitle("Default Follower Level")
      .setCustomId(`dock-default-level:${dockId}`)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "Choose the permission level assigned to new followers.",
        ),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Default Level")
          .setStringSelectMenuComponent(levelSelect),
      ),
  );
};
