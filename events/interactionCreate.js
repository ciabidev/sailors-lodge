const { Events, MessageFlags, ComponentType } = require("discord.js");
const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder,
} = require("discord.js");

const { issues } = require("../config.json");

// Map to track active party card interactions by messageId
const activePartyCards = new Map();

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const client = interaction.client;

    try {
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

      // ✅ Handle modals
      if (interaction.isModalSubmit()) {
        if (interaction.customId === "party-modal") {
          await handlePartyModalSubmit(interaction, client);
        }
        return;
      }

      // ✅ Handle button clicks
      if (interaction.isButton()) {
        const buttonIds = ["party-edit", "party-delete", "party-join", "party-leave", "party-refresh"];
        if (buttonIds.includes(interaction.customId)) {
          await handleButtonClick(interaction, client);
        }
        return;
      }

      // ✅ Handle normal slash commands
      if (!interaction.isChatInputCommand()) return;

      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

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
  },
};

async function handleButtonClick(interaction, client) {
  const messageId = interaction.message.id;
  let party = activePartyCards.get(messageId);

  // If party not in memory, fetch from DB
  if (!party) {
    // Try to extract join code from the message
    try {
      // Look for join code in embeds or message content
      let joinCode = null;
      
      // Check embeds first (from ContainerBuilder)
      if (interaction.message.embeds && interaction.message.embeds.length > 0) {
        const embeds = interaction.message.embeds;
        for (const embed of embeds) {
          const description = embed.description || "";
          const joinCodeMatch = description.match(/Join Code: (\w+)/);
          if (joinCodeMatch) {
            joinCode = joinCodeMatch[1];
            break;
          }
        }
      }
      
      // If not found in embeds, check for components
      if (!joinCode && interaction.message.components) {
        // Try to get from DB by user's current party
        const userParty = await client.modules.db.getCurrentParty(interaction.user.id);
        if (userParty) {
          party = userParty;
        }
      }
      
      // Last resort - fetch by join code
      if (!party && joinCode) {
        party = await client.modules.db.getPartyFromJoinCode(joinCode);
      }
    } catch (err) {
      console.error("Error fetching party info:", err);
    }
  }

  if (!party) {
    return interaction.reply({
      content: "Could not find party information. The party may have been deleted.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  // Cache the party
  activePartyCards.set(messageId, party);

  // EDIT button (host only)
  if (interaction.customId === "party-edit") {
    if (interaction.user.id !== party.host.id) {
      return interaction.reply({
        content: "Only the party leader can edit.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Show modal
    await client.modules.partyConfigModal(
      interaction,
      {
        name: party.name,
        description: party.description || "",
        limit: party.memberLimit || 10,
        visibility: party.visibility || "public",
      }
    );
    return;
  }

  // DELETE button (host only)
  if (interaction.customId === "party-delete") {
    if (interaction.user.id !== party.host.id) {
      return interaction.reply({
        content: "Only the party leader can delete.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    await client.modules.deleteParty(interaction, party);
    activePartyCards.delete(messageId);
    return;
  }

  // JOIN button
  if (interaction.customId === "party-join") {
    await client.modules.joinParty(interaction, party.joinCode);
    return;
  }

  // LEAVE button
  if (interaction.customId === "party-leave") {
    await client.modules.leaveParty(interaction, party._id);
    return;
  }

  // REFRESH button
  if (interaction.customId === "party-refresh") {
    party = await client.modules.db.getPartyFromJoinCode(party.joinCode);
    activePartyCards.set(messageId, party);
    const updatedCard = await client.modules.renderPartyCard(party, interaction);

    // Defer interaction to prevent timeout
    await interaction.deferUpdate();

    // Edit message
    await interaction.editReply({
      components: [...updatedCard],
    });
    return;
  }
}

async function handlePartyModalSubmit(interaction, client) {
  const messageId = interaction.message?.id;
  let party = messageId ? activePartyCards.get(messageId) : null;

  const name = interaction.fields.getTextInputValue("name");
  const description = interaction.fields.getTextInputValue("description");
  const limit = parseInt(interaction.fields.getTextInputValue("limit")) || 10;
  const visibility = interaction.fields.getStringSelectValues("visibility")[0];

  // Case 1: Editing an existing party
  if (party && messageId) {
    if (interaction.user.id !== party.host.id) {
      return interaction.reply({
        content: "Only the party leader can edit.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Update the party in DB
    party = await client.modules.db.updateParty(
      party._id,
      {
        $set: {
          name,
          description,
          memberLimit: limit,
          visibility,
        },
      },
      interaction
    );

    // Update the stored party
    activePartyCards.set(messageId, party);

    // Render updated card and reply
    const updatedCard = await client.modules.renderPartyCard(party, interaction);
    await interaction.update({
      components: updatedCard,
    });
    return;
  }

  // Case 2: Creating a new party
  const currentParty = await client.modules.db.getCurrentParty(interaction.user.id);
  if (currentParty) {
    return interaction.reply({
      content: "You are already in a party.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  // Create the party in DB
  party = await client.modules.db.createParty(
    name,
    description,
    visibility,
    limit,
    interaction.user
  );

  // Render party card
  const partyCard = await client.modules.renderPartyCard(party, interaction);

  // Reply to the modal submission with the party card
  const response = await interaction.reply({
    components: partyCard,
    flags: [MessageFlags.IsComponentsV2],
    withResponse: true,
  });

  // Store party in memory and DB
  const message = response.resource.message;
  if (message?.id) {
    activePartyCards.set(message.id, party);
    await client.modules.db.addPartyCardMessage(party._id, {
      channelId: message.channelId,
      messageId: message.id,
    });
  }
}
