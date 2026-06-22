require("dotenv").config();

const Sentry = require("@sentry/node");

const sentryDsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn) && process.env.NODE_ENV !== "test",
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
  sendDefaultPii: false,
  tracePropagationTargets: [],
  integrations: [
    // Record older caught errors which currently end in console.error().
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
  ],
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (name === "GET /" || name.includes("health")) return 0;
    return inheritOrSampleWith(process.env.NODE_ENV === "development" ? 1 : 0.1);
  },
  beforeSend(event) {
    // Discord and HTTP payloads may contain message text, tokens, or user data.
    delete event.user;

    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.headers;
      delete event.request.query_string;
    }

    return event;
  },
});

module.exports = Sentry;
