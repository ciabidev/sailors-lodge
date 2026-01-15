const {
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require("discord.js");

async function partyCardCollector(interaction, party, message) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 10 * 60_000, // 10 minutes
  });

  collector.on("collect", async (btn) => {
    // EDIT button (host only)
    if (btn.customId === "party-edit") {

      if (btn.user.id !== party.host.id) {
        return btn.reply({ content: "Only the party leader can edit." });
      }

      // Open modal for editing
      await interaction.client.modules.partyConfigModal(
        btn,
        {
          name: party.name,
          description: party.description || "",
          limit: party.memberLimit || 10,
          visibility: party.visibility || "public",
        },
      );

      const editModal = await btn.awaitModalSubmit({
        filter: (i) => i.customId === "party-modal" && i.user.id === party.host.id,
        time: 60_000,
      });
      await editModal.update({ components: await interaction.client.modules.renderPartyCard(party, interaction) }); // editModal is so impatient for a response lol so we have to put it before the long updateParty 

      party = await interaction.client.modules.db.updateParty(
        party._id,
        {
          $set: {
            name: editModal.fields.getTextInputValue("name"),
            description: editModal.fields.getTextInputValue("description"),
            memberLimit: parseInt(editModal.fields.getTextInputValue("limit")) || 10,
            visibility: editModal.fields.getStringSelectValues("visibility")[0],
          },
        },
        btn
      );
    }

    // DELETE button (host only)
    if (btn.customId === "party-delete") {
      if (btn.user.id !== party.host.id) {
        return btn.reply({ content: "Only the party leader can delete." });
      }

      await interaction.client.modules.deleteParty(btn, party);
      collector.stop();
    }

    // JOIN button (everyone)
    if (btn.customId === "party-join") {
      await interaction.client.modules.joinParty(btn, party.joinCode);
    }

    if (btn.customId === "party-leave") {
      await interaction.client.modules.leaveParty(btn, party._id);
    }

    if (btn.customId === "party-refresh") {
      party = await interaction.client.modules.db.getPartyFromJoinCode(party.joinCode);
      const updatedCard = await interaction.client.modules.renderPartyCard(party, interaction);

      // Defer interaction to prevent timeout
      await btn.deferUpdate();

      // Edit ephemeral message
      await btn.editReply({
        components: [...updatedCard],
      });
    }

  });
}

module.exports = partyCardCollector;
