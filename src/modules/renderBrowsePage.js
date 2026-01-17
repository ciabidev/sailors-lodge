const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

module.exports = function renderBrowsePage({ pages, pageIndex, client }) {
  const page = pages[pageIndex];

  const container = new ContainerBuilder().addTextDisplayComponents((t) =>
    t.setContent(`## Browse Parties (Page ${pageIndex + 1}/${pages.length})`),
  );

  for (const party of page) {
    const { name, description, host, members, memberLimit, joinCode, _id } = party;

    const joinButton = new ButtonBuilder()
      .setCustomId(`party-join:${_id}`)
      .setLabel("Join")
      .setStyle(ButtonStyle.Success);

    container.addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(joinButton)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### ${client.modules.escapeMarkdown(name)}`),
        ),
    );

    container.addTextDisplayComponents((t) =>
      t.setContent(`**Host:** <@${host.id}> | **Members:** ${members.length}/${memberLimit}`),
    );

    if (description?.length) {
      container.addTextDisplayComponents((t) =>
        t.setContent(description.length > 100 ? description.slice(0, 100) + "..." : description),
      );
    }

    container.addTextDisplayComponents((t) => t.setContent(`**Join Code:** ${joinCode}`));

    container.addSeparatorComponents((s) =>
      s.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  return container;
};
