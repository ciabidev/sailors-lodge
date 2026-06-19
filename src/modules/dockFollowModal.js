const {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

module.exports = async function dockFollowModal(
  interaction,
  dockId,
  customId = "dock-follow-modal",
  defaults = {},
) {
  const isHomePingRoles = customId === "dock-home-ping-roles";
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("dock-follow-channel")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(1)
    .setMaxValues(1);

  const dock = await interaction.client.modules.db.getDock(dockId);
  const keywords = [...new Set((dock?.keywords ?? []).filter(Boolean))].slice(0, 25);

  const keywordSelect = keywords.length
    ? new StringSelectMenuBuilder()
        .setCustomId("keyword")
        .setPlaceholder("Select a keyword")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          keywords.map((keyword) => ({
            label: keyword.slice(0, 100),
            value: keyword.slice(0, 100),
          })),
        )
    : null;
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("roles")
    .setMaxValues(25)
    .setRequired(false);
  if (defaults.channelIds?.length) {
    channelSelect.setDefaultChannels(defaults.channelIds.slice(0, 1));
  }
  const modal = new ModalBuilder()
    .setTitle(isHomePingRoles ? "Home Ping Roles" : "Dock Follow Settings")
    .setCustomId(`${customId}:${dockId}`);

  if (!isHomePingRoles) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Set receiving channel")
        .setDescription("A channel can receive messages from multiple Docks")
        .setChannelSelectMenuComponent(channelSelect),
    );
  }

  if (keywordSelect) {
    modal
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Set keyword")
          .setDescription("Choose a keyword to assign ping roles to")
          .setStringSelectMenuComponent(keywordSelect),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Set ping roles")
          .setDescription("These roles will be pinged when the selected keyword is used")
          .setRoleSelectMenuComponent(roleSelect),
      );
  }

  return interaction.showModal(modal);
};
