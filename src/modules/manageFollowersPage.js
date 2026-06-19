const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorSpacingSize,
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

  if (!page.length) {
    container.addTextDisplayComponents((t) =>
      t.setContent("This Dock doesn't have any followers yet."),
    );
  }

  for (const follower of page) {

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### ${client.modules.escapeMarkdown(follower.guildName ?? follower.guildId)}\n**Status:** ${follower.contributor ? "Contributor" : "Read-only"}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`dock-alter-follower:${dock._id}:${follower.guildId}`)
            .setLabel(follower.contributor ? "Demote" : "Promote")
            .setStyle(follower.contributor ? ButtonStyle.Danger : ButtonStyle.Success),
        ),
    );
    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
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
