const { Events, MessageFlags } = require("discord.js");
const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
  ActionRowBuilder,
  SectionBuilder,
} = require("discord.js");
const { ObjectId } = require("mongodb");
const { issues } = require("../config.json");
module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const client = interaction.client;

    // ✅ Handle autocomplete first
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
      return;
    }
    
    async function handlePartyButton(interaction) {
      const btn = interaction;
      const [action, partyId] = btn.customId.split(":");
      if (partyId) {
        let party = await btn.client.modules.db.getParty(new ObjectId(partyId));
        switch (action) {
          case "party-edit":
            await btn.client.modules.editParty(btn, party);
            break;

          case "party-delete":
            if (btn.user.id !== party.host.id) {
              return btn.reply({
                content: "Only the party leader can delete.",
                flags: [MessageFlags.Ephemeral],
              });
            }
            await btn.client.modules.deleteParty(btn, party);
            break;
          case "party-join":
            await btn.client.modules.joinParty(btn, party.joinCode);
            break;
          case "party-leave":
            await btn.client.modules.leaveParty(btn, party);
            break;
          case "party-card-refresh":
            const updatedParty = await btn.client.modules.db.getPartyFromJoinCode(party.joinCode);
            const updatedCard = await btn.client.modules.renderPartyCard(updatedParty, btn);
            await btn.deferUpdate();
            await btn.editReply({
              components: [...updatedCard],
            });
            break;
          case "party-delete-confirm":
              await btn.deferUpdate();
              await btn.client.modules.db.deleteParty(party._id, btn);
              btn.editReply({
                components: [new TextDisplayBuilder().setContent("Party deleted.")],
              });
              await btn.client.modules.updatePartyCards(btn, party);
              break;
          case "party-delete-cancel":
            await btn.editReply({
              components: [new TextDisplayBuilder().setContent("Cancelled.")],
            });
            break;
        }
      }
    }
       

    if (interaction.isButton()) {
      const [action, partyId] = interaction.customId.split(":");

      // Page navigation
      if (action === "parties-previous-page" || action === "parties-next-page") {
        const state = require("../commands/party/browse").browsePages.get(interaction.user.id);
        if (!state) return; // expired or user didn't start browse

        const { pages, pageSelector } = state;
        let { pageIndex } = state;

        if (action === "parties-previous-page") {
          pageIndex = (pageIndex - 1 + pages.length) % pages.length;
        } else if (action === "parties-next-page") {
          pageIndex = (pageIndex + 1) % pages.length;
        }

        // Update pageIndex in state
        state.pageIndex = pageIndex;

        // Render new page
        const newPage = (() => {
          const page = pages[pageIndex];
          const container = new ContainerBuilder().addTextDisplayComponents((t) =>
            t.setContent(`## Browse Parties (Page ${pageIndex + 1}/${pages.length})`)
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
                  new TextDisplayBuilder().setContent(
                    `### ${interaction.client.modules.escapeMarkdown(name)}`
                  )
                )
            );

            container.addTextDisplayComponents(
              (t) =>
                t.setContent(
                  `**Host:** <@${host.id}> | **Members:** ${members.length}/${memberLimit}`
                ),
              (t) =>
                t.setContent(
                  `**Description:** ${
                    (description || "No description").length > 100
                      ? description.slice(0, 100) + "..."
                      : description
                  }`
                ),
              (t) => t.setContent(`**Join Code:** ${joinCode}`)
            );

            container.addSeparatorComponents((s) =>
              s.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
            );
          }

          return container;
        })();

        await interaction.update({
          components: [newPage, pageSelector],
        });
        return;
      }

      // Handle party buttons
      if (partyId) {
        await handlePartyButton(interaction);
        return;
      }
    }

    // ✅ Handle normal slash commands
    if (interaction.isChatInputCommand()) {

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      let content = error.message;
      if (error.stack) {
        content += `\n\n${error.stack}`;
      }

      if (error.code === 50001) {
        content = "I don't have access to this channel.";
      }

      const replyContent = {
        content: `An error occurred while executing this command, please report this to us via our [issue board](${issues})\n\`\`\`${content}\`\`\``,
        flags: [MessageFlags.Ephemeral],
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyContent);
      } else {
        await interaction.reply(replyContent);
      }
    }
  }

  },
};
