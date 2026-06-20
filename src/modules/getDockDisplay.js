const {
  ActionRowBuilder,
  SectionBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require("discord.js");

module.exports = function getDockDisplay(container, dock, buttons, client) {
  const {
    name,
    description,
    channelNames,
    guildName,
    channelIds,
    guildId: publisherGuildId,
    guildIconURL,
    defaultLevel,
  } = dock;

  const dockName = name ?? "Untitled Dock";
  const dockChannels = channelNames?.length
    ? channelNames.join(", ")
    : (channelIds ?? []).map((id) => `#${id}`).join(", ");
  const dockPublisher = guildName ?? publisherGuildId ?? "Unknown publisher";

  const truncatedDescription =
    description?.length > 300 ? description.slice(0, 300) + "..." : description;
  const actionButtons = Array.isArray(buttons) ? buttons.filter(Boolean) : [buttons].filter(Boolean);

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${client.modules.escapeMarkdown(dockName)}${truncatedDescription ? `\n${truncatedDescription}` : ""}`,
    ),
  );

  if (guildIconURL) {
    section.setThumbnailAccessory(
      new ThumbnailBuilder().setURL(guildIconURL).setDescription(dockPublisher),
    );
  } else if (actionButtons.length === 1) {
    section.setButtonAccessory(actionButtons[0]);
  }

  container.addSectionComponents(section);

  container.addTextDisplayComponents((t) =>
    t.setContent(
      `**Publisher:** ${client.modules.escapeMarkdown(dockPublisher)}\n**Channel(s):** ${client.modules.escapeMarkdown(dockChannels || "Unknown channel")}\n**Default Perms:** ${dock.defaultLevel ?? "passive"}`,
    ),
  );

  if (guildIconURL && actionButtons.length > 0) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(actionButtons));
  } else if (!guildIconURL && actionButtons.length > 1) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(actionButtons));
  }

  container.addSeparatorComponents((s) =>
    s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
  );

  return container;
};
