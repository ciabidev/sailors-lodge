const Sentry = require("@sentry/node");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");

function buildReportErrorComponents(eventId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`report-error:${eventId}`)
        .setLabel("Report error")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function captureError(error, { source = "application", tags = {} } = {}) {
  return Sentry.captureException(error, {
    tags: { source, ...tags },
  });
}

async function notifyUser(context, eventId) {
  if (!context || !eventId) return false;

  const content =
    `Something went wrong. Error ID: \`${eventId}\`. ` +
    "Please report this ID to the bot developers.";
  const components = buildReportErrorComponents(eventId);

  try {
    if (context.isAutocomplete?.()) {
      await context.respond([]);
      return false;
    }

    if (context.isRepliable?.()) {
      const response = {
        content,
        components,
        flags: [MessageFlags.Ephemeral],
      };

      if (context.replied || context.deferred) {
        await context.followUp(response);
      } else {
        await context.reply(response);
      }
      return true;
    }

    if (context.author && !context.author.bot && typeof context.reply === "function") {
      await context.reply({
        content,
        components,
        allowedMentions: { repliedUser: false },
      });
      return true;
    }

    if (context.isThread?.() && typeof context.send === "function") {
      await context.send({ content, components });
      return true;
    }
  } catch (noticeError) {
    // A failed/expired Discord interaction cannot be notified reliably.
    console.warn(`[error-notice:${eventId}] Could not notify the user:`, noticeError);
  }

  return false;
}

async function reportError(error, options = {}) {
  const eventId = captureError(error, options);
  await notifyUser(options.context, eventId);
  return eventId;
}

module.exports = { buildReportErrorComponents, captureError, notifyUser, reportError };
