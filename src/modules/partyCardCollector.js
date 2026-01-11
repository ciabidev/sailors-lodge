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
    // EDIT button (owner only)
    if (btn.customId === "party-edit") {
      if (btn.user.id !== party.owner.id) {
        return btn.reply({ content: "Only the party leader can edit.", ephemeral: true });
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
        interaction
      );

      const editModal = await btn.awaitModalSubmit({
        filter: (i) => i.customId === "party-modal" && i.user.id === party.owner.id,
        time: 60_000,
      });

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
        interaction
      );

      await editModal.update({ components: await interaction.client.modules.renderPartyCard(party, interaction) });
    }

    // DELETE button (owner only)
    if (btn.customId === "party-delete") {
      if (btn.user.id !== party.owner.id) {
        return btn.reply({ content: "Only the party leader can delete.", ephemeral: true });
      }

      await interaction.client.modules.db.deleteParty(party._id);
      await btn.update({ content: "Party deleted.", components: [] });
      collector.stop();
    }

    // JOIN button (everyone)
    if (btn.customId === "party-join") {
      await interaction.client.modules.joinParty(btn, party.joinCode);
    }
  });
}

module.exports = partyCardCollector;
