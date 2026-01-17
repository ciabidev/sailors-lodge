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
