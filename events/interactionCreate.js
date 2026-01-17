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

const issues = process.env.ISSUES_URL;
const { browsePages } = require("../commands/party/browse");

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

    if (interaction.isModalSubmit()) {
      const [prefix, partyId] = interaction.customId.split(":");
      if (prefix === "party-modal") {
          const name = interaction.fields.getTextInputValue("name");
          const description = interaction.fields.getTextInputValue("description");
          const memberLimit = parseInt(interaction.fields.getTextInputValue("limit")) || 10;
          const visibility = interaction.fields.getStringSelectValues("visibility")[0];

          if (!partyId) {
            // CREATE branch
            const party = await interaction.client.modules.db.createParty(
              name,
              description,
              visibility,
              memberLimit,
              interaction.user,
            );

            // Send the party card (DM or channel)
            let dm = interaction.options?.getBoolean("dm") ?? interaction.guildId === null;
            let message;

            if (dm) {
              await interaction.reply({
                content: "Party card will be sent to you in DM",
                flags: [MessageFlags.Ephemeral],
              });
              message = await interaction.user.send({
                components: await interaction.client.modules.renderPartyCard(party, interaction),
                flags: MessageFlags.IsComponentsV2,
              });
            } else {
              const response = await interaction.reply({
                components: await interaction.client.modules.renderPartyCard(party, interaction),
                flags: MessageFlags.IsComponentsV2,
                withResponse: true,
              });
              message = response.resource.message;
            }

            // Store message in DB
            await interaction.client.modules.db.addPartyCardMessage(party._id, {
              channelId: message.channelId,
              messageId: message.id,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
          } else {
            // EDIT branch
            const party = await interaction.client.modules.db.getParty(new ObjectId(partyId));

            if (!party) {
              return interaction.reply({
                content: "This party does not exist.",
                flags: [MessageFlags.Ephemeral],
              });
            }
            if (interaction.user.id !== party.host.id) {
              return interaction.reply({
                content: "Only the leader can submit this.",
                flags: [MessageFlags.Ephemeral],
              });
            }

            const updatedParty = await interaction.client.modules.db.updateParty(
              party._id,
              { $set: { name, description, memberLimit, visibility } },
              interaction,
            );

            try {
              await interaction.update({
                components: await interaction.client.modules.renderPartyCard(
                  updatedParty,
                  interaction,
                ),
              }); // edit and delete have been made into commands and are no longer buttons, this is just here in case we bring them back
            } catch (err) {
              if (err.code === 10008) { // error if used from a command
                interaction.reply({
                  content: "Party updated successfully!",
                  flags: [MessageFlags.Ephemeral],
                });
              }
            }

            await interaction.client.modules.updatePartyCards(interaction, updatedParty);
          }
      }
    }

    async function handlePartyButton(interaction) {
      const btn = interaction;
      const [action, partyId] = btn.customId.split(":");
      if (partyId) {
        let party = await btn.client.modules.db.getParty(new ObjectId(partyId));
        switch (action) {
          // edit and delete have been made into commands and are no longer buttons, this is just here in case we bring them back
          case "party-edit":
            await btn.client.modules.editParty(btn, party);
            break;

          case "party-delete":
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
            await btn.update({
              components: [new TextDisplayBuilder().setContent("Deleting party...")],
            });
            await btn.client.modules.db.deleteParty(party._id, btn);
            btn.editReply({
              components: [new TextDisplayBuilder().setContent("Party deleted.")],
            });
            party = await btn.client.modules.db.getParty(new ObjectId(partyId));
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

      const id = interaction.customId;

      if (id === "parties-prev" || id === "parties-next") {
        const state = browsePages.get(interaction.user.id);
        if (!state) return;

        const { pages } = state;

        state.pageIndex =
          id === "parties-prev"
            ? (state.pageIndex - 1 + pages.length) % pages.length
            : (state.pageIndex + 1) % pages.length;

        await interaction.update({
          components: [
            renderBrowsePage({
              pages,
              pageIndex: state.pageIndex,
              client: interaction.client,
            }),
            interaction.message.components[1],
          ],
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
 