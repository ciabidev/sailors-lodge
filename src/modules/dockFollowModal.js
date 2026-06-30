const {
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
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

  const dock = await interaction.client.modules.db.getDock(dockId);
  const keywords = [...new Set((dock?.keywords ?? []).filter(Boolean))].slice(0, 25);
  const keywordSelect =
    keywords?.length > 0
      ? new StringSelectMenuBuilder()
          .setCustomId("keyword")
          .setPlaceholder("Select one or more keywords")
          .setMinValues(1)
          .setMaxValues(keywords.length)
          .setRequired(false)
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
    .setTitle(customId === "dock-home-ping-roles" ? "Home Ping Roles" : "Dock Follow Settings")
    .setCustomId(`${customId}:${dockId}`);

  const follower = await interaction.client.modules.db.getDockFollower(dockId, interaction.guildId);
  const serverBan = dock
    ? await interaction.client.modules.db.getDockServerBan(dock.guildId, interaction.guildId)
    : null;
  if (follower?.banned || serverBan) {
    return interaction.reply({
      content: "This server is banned from following Docks from that server.",
      flags: MessageFlags.Ephemeral,
    });
  }
  if (follower) {
    if (follower.level === "admin" || interaction.guildId === dock.guildId) {
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("Set Gatekeeper Role")
          .setDescription("Deny/Approve Follow Requests")
          .setRoleSelectMenuComponent(
            new RoleSelectMenuBuilder()
              .setCustomId("gatekeeper")
              .setMaxValues(1)
              .setRequired(false)
              .setPlaceholder("Select a role"),
          ),
      );
    }
  }

  if (customId !== "dock-home-ping-roles") {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Set receiving channel")
        .setDescription("A channel can receive messages from multiple Docks")
        .setChannelSelectMenuComponent(channelSelect),
    );
  } else {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Toggle Own-Server Pings")
        .setDescription("If this is enabled, keywords sent from your server will also ping your server")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("ping-own-server")
            .setPlaceholder("Toggle")
            .addOptions(
              {
                label: "On",
                value: "on",
                default: defaults.pingOwnServer !== false,
              },
              {
                label: "Off",
                value: "off",
                default: defaults.pingOwnServer === false,
              },
            ),
        ),
    );
  }

  if (keywordSelect) {
    modal.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "# Keyword Pings\nConfigure which roles get pinged for each keyword",
      ),
    );
    modal
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Select keywords")
          .setDescription("When any of these keywords appear:")
          .setStringSelectMenuComponent(keywordSelect),
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("Set ping roles")
          .setDescription("Ping these roles")
          .setRoleSelectMenuComponent(roleSelect),
      );
  } else {
    modal.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "This dock has no keywords. The dock owner should add keywords to configure more ping roles.",
      ),
    );
  }

  return interaction.showModal(modal);
};
