const {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
} = require("discord.js");

module.exports = async function dockFollowModal(
  interaction,
  dockId,
  customId = "dock-follow-modal",
  defaults = {},
) {
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("dock-follow-channel")
    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    .setMinValues(1)
    .setMaxValues(1);

  if (defaults.channelIds?.length) {
    channelSelect.setDefaultChannels(defaults.channelIds.slice(0, 1));
  }

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("dock-follow-ping-roles")
    .setMaxValues(25)
    .setRequired(false);

  if (defaults.pingRoleIds?.length) {
    roleSelect.setDefaultRoles(defaults.pingRoleIds.slice(0, 25));
  }

  return interaction.showModal(
    new ModalBuilder()
      .setTitle("Dock Follow Settings")
      .setCustomId(`${customId}:${dockId}`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Set receiving channel")
          .setDescription("A channel can receive messages from multiple Docks")
          .setChannelSelectMenuComponent(channelSelect),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Set ping roles")
          .setDescription("These roles will be pinged whenever a party ping is recieved")
          .setRoleSelectMenuComponent(roleSelect),
      ),
  );
};
