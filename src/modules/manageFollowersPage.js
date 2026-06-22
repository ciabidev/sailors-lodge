const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = function manageFollowersPage({ dock, pages, pageIndex, client }) {
  const page = pages[pageIndex] ?? [];
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(
      `## Followers for ${client.modules.escapeMarkdown(dock.name)}`,
    ),
  );

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent("*Choose the default permission level assigned to new followers...*"),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`dock-manage-default-level:${dock._id}`)
          .setLabel("Set Default Level")
          .setStyle(ButtonStyle.Primary),
      ),
  );

  if (!page.length) {
    container.addTextDisplayComponents((t) =>
      t.setContent("This Dock doesn't have any followers yet."),
    );
  }

  for (const follower of page) {
    if (follower.banned) {
      const reason = client.modules.escapeMarkdown(follower.banReason ?? "No reason provided");
      const bannedAt = follower.bannedAt
        ? `\n-# Banned <t:${Math.floor(new Date(follower.bannedAt).getTime() / 1000)}:R>`
        : "";
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${client.modules.escapeMarkdown(follower.guildName ?? follower.guildId)}\n**Status:** Banned\n**Reason:** ${reason}${bannedAt}`,
        ),
      );
      continue;
    }

    const level = client.modules.dockLevels.normalize(follower.level);
    const levelDetails = client.modules.dockLevels.get(level);

    
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${client.modules.escapeMarkdown(follower.guildName ?? follower.guildId)}\n**Level:** ${levelDetails.label}\n${levelDetails.description}`,
      ),
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`dock-set-follower-level:${dock._id}:${follower.guildId}`)
          .setPlaceholder("Set follower level")
          .addOptions(
            client.modules.dockLevels.order.map((levelId) => {
              const details = client.modules.dockLevels.get(levelId);
              return {
                label: details.label,
                value: levelId,
                description: details.description,
                emoji: details.emoji,
                default: levelId === level,
              };
            }),
          ),
      ),
    );
  }

  const pageSelector = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dock-manage-followers-prev")
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pages.length <= 1),
    new ButtonBuilder()
      .setCustomId("dock-manage-followers-position")
      .setLabel(`${pageIndex + 1} / ${Math.max(pages.length, 1)}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("dock-manage-followers-next")
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pages.length <= 1),
    new ButtonBuilder()
      .setCustomId("dock-manage-followers-back")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary),
  );

  return [container, pageSelector];
};
