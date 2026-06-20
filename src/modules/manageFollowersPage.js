const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = function manageFollowersPage({ dock, pages, pageIndex, client }) {
  const page = pages[pageIndex] ?? [];
  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(
      `## Followers for ${client.modules.escapeMarkdown(dock.name)} (Page ${pageIndex + 1}/${Math.max(pages.length, 1)})`,
    ),
  );

  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents((text) =>
        text.setContent("Configure the default permission level for new followers."),
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
    const level = client.modules.dockLevels.normalize(follower.level);
    const levelDetails = client.modules.dockLevels.get(level);
    const previousLevel = client.modules.dockLevels.previous(level);
    const nextLevel = client.modules.dockLevels.next(level);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${client.modules.escapeMarkdown(follower.guildName ?? follower.guildId)}\n**Level:** ${levelDetails.label}\n${levelDetails.description}`,
      ),
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `dock-set-follower-level:${dock._id}:${follower.guildId}:${previousLevel}`,
          )
          .setLabel("Demote")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(level === client.modules.dockLevels.order[0]),
        new ButtonBuilder()
          .setCustomId(`dock-set-follower-level:${dock._id}:${follower.guildId}:${nextLevel}`)
          .setLabel("Promote")
          .setStyle(ButtonStyle.Success)
          .setDisabled(level === client.modules.dockLevels.order.at(-1)),
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
