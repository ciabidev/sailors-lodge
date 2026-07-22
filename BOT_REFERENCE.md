# Sailor's Lodge Bot Reference

This document describes the Discord bot only. It intentionally excludes the dashboard, landing page, Vite app, and Express dashboard routes.

## What the Bot Is

Sailor's Lodge is a Discord.js bot for Arcane Odyssey communities. Its main jobs are:

- Create and manage Discord coordination parties.
- DM party members when people join, leave, get kicked, lock status changes, or announcements are sent.
- Let servers configure ping groups, keyword pings, and an LFG role.
- Let servers publish, follow, and manage cross-server message feeds called Docks.
- Relay Dock messages, party cards, replies, edits, deletes, pings, and threads between Discord servers.
- Capture errors with Sentry and let users submit bug reports.

The bot uses MongoDB as its shared data store.

## Runtime Shape

Entry point: `index.js`

The process:

1. Loads Sentry setup from `instrument.js`.
2. Loads environment variables with `dotenv`.
3. Creates a Discord.js `Client`.
4. Dynamically loads slash commands from `commands/*/*.js`.
5. Dynamically loads event handlers from `events/*.js`.
6. Dynamically loads shared modules from `src/modules/*.js`.
7. Connects to Discord with either the dev token or production token.
8. Starts the Express app through `src/server/app`, but this reference does not document dashboard/server routes.
9. Closes Sentry on `SIGINT` and `SIGTERM`.

Discord intents:

- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildMembers`
- `DirectMessages`
- `DirectMessageTyping`
- `DirectMessagePolls`

Partials:

- `Channel`
- `Message`

The websocket identify browser is set to `Discord iOS`.

## Configuration

The bot reads configuration from environment variables. Do not commit real values.

Bot variables:

- `PRODUCTION_TOKEN`: production bot token.
- `DEV_TOKEN`: development bot token.
- `PRODUCTION_CLIENT_ID`: production application/client id.
- `DEV_CLIENT_ID`: development application/client id.
- `DEV_IDS`: comma-separated Discord user ids with developer permissions.
- `GUILD_ID`: dev guild id, required for dev command deployment.
- `DEV_MODE`: `true` uses dev token/client/database, otherwise production.
- `MONGO_URI`: MongoDB connection string.
- `ISSUES` or `ISSUES_URL`: issue board URL shown in command error replies.
- `SENTRY_DSN`: Sentry project DSN.
- `SENTRY_ENVIRONMENT`: Sentry environment name.
- `SCHEDULE_TIME_ZONE`: fallback timezone for internal scheduled-time formatting, default `America/New_York`. User-created schedules require a timezone saved with `/timezone set`.

Deployment:

- `npm start`: runs `node index.js`.
- `npm run dev`: deploys commands, then starts `nodemon index.js`.
- `npm test`: runs Node tests under `tests/*.test.js`.
- `npm run postinstall`: deploys slash commands.

Command deployment:

- `deploy-commands.js` loads top-level slash commands only.
- Subcommand files are skipped during deployment.
- In dev mode, commands require `GUILD_ID` but are currently still deployed with `Routes.applicationCommands(clientId)`.
- Missing token/client/guild env vars stop deployment with a clear error.

## Dependencies Used by the Bot

Main bot dependencies:

- `discord.js`: Discord gateway, slash commands, components, modals, webhooks, and interactions.
- `mongodb`: direct MongoDB driver.
- `dotenv`: environment loading.
- `chrono-node`: natural language scheduled-time parsing.
- `@sentry/node`: error and feedback reporting.
- `express`: process also hosts an app, but dashboard routes are out of scope here.

## MongoDB

Database selection:

- `development` when `DEV_MODE=true`.
- `production` otherwise.

Connection module: `src/modules/db.js`

`db.js` starts connecting as soon as the module loads and exposes `ready`. Event handlers wait for `client.modules.db.ready` before executing.

Collections:

- `serverSettings`: per-guild ping groups, keyword toggle, and LFG role.
- `userSettings`: per-user timezone used for scheduled pings.
- `parties`: active/deleted party documents and tracked party card messages.
- `docks`: published Dock definitions.
- `dockFollows`: follower records, receiving channels, Host Roles, keyword ping roles, and follower access levels.
- `dockWebhooks`: saved Dock relay webhooks per guild/channel.
- `dockMessages`: root relayed messages and delivery message ids.
- `dockThreads`: root relayed threads and delivered thread ids.
- `dockServerBans`: server-wide Dock follow bans.
- `migrations`: only referenced by an old commented migration.

Startup migrations:

- Renames old `dockServers` collection to `dockFollows` if needed.
- Converts old Dock follower `contributor` booleans to access `level`.
- Ensures invalid follower levels become the default level.
- Ensures `banned` exists on Dock followers.
- Ensures Dock `defaultLevel` is valid.
- Migrates old follower bans into `dockServerBans`.

Indexes:

- `serverSettings.guildId`
- `userSettings.userId` (unique)
- `parties.members.id`
- `parties.deleted, parties.createdAt`
- `docks.guildId`
- `docks.channelIds`
- `dockFollows.dockId, dockFollows.banned`
- `dockFollows.guildId, dockFollows.banned`
- `dockFollows.channelIds, dockFollows.banned`
- `dockFollows.dockId, dockFollows.guildId`
- `dockWebhooks.guildId, dockWebhooks.channelId`
- `dockMessages.rootChannelId, dockMessages.rootMessageId`
- `dockMessages.deliveries.channelId, deliveries.messageId`
- `dockMessages.deliveries.threadId, deliveries.messageId`
- `dockThreads.dockId, dockThreads.rootThreadId`
- `dockThreads.deliveries.threadId`
- `dockServerBans.ownerGuildId, dockServerBans.targetGuildId`

Party cleanup:

- Parties older than 7 days are soft-deleted.
- Cleanup runs at startup and hourly.
- Deleted parties have `members: []` and `deleted: true`.

## Data Shapes

### Server Settings

Created automatically when first requested:

```js
{
  guildId,
  pingGroups: [],
  keywordPingsEnabled: true,
  lfgRoleId
}
```

Ping group shape:

```js
{
  name,
  roleId,
  allowedRoles: [],
  keywords: []
}
```

### Party

Created by `/party create`:

```js
{
  name,
  description,
  status,
  visibility,
  memberLimit,
  host,
  members: [host],
  joinCode,
  createdAt,
  locked,
  deleted,
  cards: []
}
```

Important rules:

- A user can only be in one party at a time.
- The host is the party leader.
- Join codes are six numeric digits.
- Party cards are tracked so old cards can be refreshed or cleaned up.
- Private party cards do not relay through Docks.

Tracked party card shape:

```js
{
  channelId,
  messageId,
  userId,
  guildId
}
```

`guildId` is missing/null for DM cards.

### Dock

Created by `/dock publish`:

```js
{
  name,
  guildId,
  guildName,
  channelIds,
  description,
  keywords,
  publishMode,
  accessMode,
  defaultLevel,
  gatekeeperRoleId,
  official,
  createdAt
}
```

Supported publish modes:

- `all`: relay all normal messages in source/followed channels.
- `manual`: only relay messages published with `!p`.

Supported access modes:

- `open`: following starts immediately.
- `request`: following starts as `no-access` until approved.

### Dock Follow

Created for both the publishing server and follower servers:

```js
{
  dockId,
  guildId,
  guildName,
  channelIds,
  hostRoleIds,
  keywordPings,
  pingOwnServer,
  shareVoiceInvites,
  level,
  banned,
  banReason,
  bannedAt,
  bannedByUserId,
  serverBanOwnerGuildId,
  createdAt
}
```

### Dock Access Levels

Defined in `src/modules/dockLevels.js`:

- `no-access`: cannot receive or send.
- `passive`: can receive.
- `sender`: can receive and send.
- `contributor`: can receive, send, and trigger Dock pings.
- `admin`: can receive, send, ping, and manage follower access.

Default follower level: `passive`.

Publishers can always manage their own Docks. Non-publisher servers need readable `admin` access to manage follower access.

### Dock Webhook

Saved after a relay webhook is found or created:

```js
{
  guildId,
  channelId,
  guildName,
  webhookId,
  webhookToken,
  createdAt,
  updatedAt
}
```

The relay layer caches webhooks for 10 minutes and invalidates them when Discord says a webhook is unknown.

### Dock Message

Maps a source message to relayed copies:

```js
{
  dockId,
  rootGuildId,
  rootChannelId,
  rootMessageId,
  deliveries: [
    {
      guildId,
      channelId,
      threadId,
      messageId
    }
  ],
  createdAt,
  updatedAt
}
```

Used for:

- Editing relayed copies.
- Deleting relayed copies.
- Reply jump links.
- Connecting threads attached to relayed party cards/messages.

### Dock Thread

Maps a source thread to relayed threads:

```js
{
  dockId,
  rootGuildId,
  rootChannelId,
  rootThreadId,
  name,
  deliveries: [
    {
      guildId,
      channelId,
      threadId
    }
  ],
  createdAt,
  updatedAt
}
```

One root Discord thread can exist in multiple Dock networks, so `dockId` is part of the thread identity.

## Slash Commands

### `/help`

Shows the main bot guide:

- Party commands.
- Party pings.
- Party owner commands.
- Docks summary.
- Settings summary.
- Troubleshooting for party DMs and announcements.

Default behavior:

- In a server, the guide is ephemeral unless `ephemeral:false`.
- Sends a follow-up warning that users should enable DMs.

### `/bugreport`

Opens a modal with:

- User goal.
- What went wrong.
- Optional reproduction steps.
- Optional Sentry error id.
- Optional Discord username.

Submissions become Sentry feedback.

### `/status`

Shows:

- Bot online/degraded status.
- Database online/offline status.
- Number of guilds in cache.
- Discord websocket latency.

It pings MongoDB with `{ ping: 1 }`.

### `/timezone set timezone:<zone>`

Saves an IANA timezone on the Discord user, such as `America/Chicago`. A saved timezone is required before using scheduled `/party ping` or `/party lfg` times. Natural-language clock times and autocomplete are interpreted in that timezone.

### `/reload`

Developer-only command.

Rules:

- User id must be listed in `DEV_IDS`.
- Reloads one command module from `require.cache`.
- Uses the command path saved during startup.

Current note: `reload.js` references `MessageFlags` without importing it.

## Party Commands

Top-level command: `/party`

Subcommands are loaded through `src/modules/subcommandFolder.js`.

### `/party create [dm]`

Creates a new party through a modal.

Flow:

1. Checks whether the user is already in a party.
2. Opens the party configuration modal.
3. Modal submission creates the party.
4. Sends the party card in the channel or DM.
5. Stores the card message in MongoDB.
6. Sends the party tip DM.

`dm:true` sends the party card to the creator by DM.

### Party Configuration Modal

Fields:

- Party name, default `<username>'s party`, max 150 chars.
- Status: `not-started`, `starting`, or `active`.
- Description, optional, max 500 chars.
- Member limit, parsed as a number, default 10.
- Visibility: `public` or `private`.

Status labels shown on cards:

- `not-started`: Not Started.
- `starting`: Starting.
- `active`: Active.

### Party Card

Rendered with Components V2.

Shows:

- Party name.
- Description or `No description`.
- Status.
- Visibility.
- Member count and member limit.
- Members, with the host marked as leader.
- Join code as `/join <code>`.
- Disclaimer that this is a Discord group, not an in-game party.

Buttons:

- Join Group: `party-join:<partyId>`
- Leave: `party-leave:<partyId>`
- Refresh: `party-card-refresh:<partyId>`

### `/party join code:<code>`

Joins a party by join code.

Validation:

- Join code must exist.
- Party must not be locked.
- Party must not be deleted.
- User must not already be in that party.
- Party must not be full.
- User must not already be in another party.

After joining:

- Adds the user to `members`.
- DMs members a join notification.
- Sends the joining user a party card in DM when used in a server.
- Stores the new party card message.
- Sends the party tip.
- Refreshes all tracked cards.

### `/party leave`

Leaves the user's current party.

Flow:

- Defers an ephemeral reply.
- Rejects if the party no longer exists.
- Rejects if the user is not a member.
- DMs members a leave notification.
- Removes the user from members.
- If the leaving user was host and no members remain, deletes the party.
- If the leaving user was host and members remain, makes the first remaining member host.
- Refreshes all tracked cards.

Current implementation note: `removeMembersFromParty` expects an array, but `leaveParty` passes a string user id.

### `/party delete`

Deletes the host's current party after confirmation.

Rules:

- Party must exist.
- User must be in a party.
- User must be the party host.

Shows ephemeral Yes/No buttons:

- `party-delete-confirm:<partyId>` soft-deletes the party and refreshes cards.
- `party-delete-cancel:<partyId>` cancels.

### `/party edit`

Lets the host edit the current party through the same party modal.

Rules:

- Party must exist.
- User must be in a party.
- User must be the party host.

Updates:

- Name.
- Description.
- Status.
- Member limit.
- Visibility.

After updating, it refreshes all tracked cards.

### `/party togglelock`

Toggles whether users can join the party.

Behavior:

- If locked, unlocks and notifies members.
- If unlocked, locks and notifies members.
- Replies in-channel with the new state.

Current implementation note: it assumes `getCurrentParty` returns a party and can throw if the user is not in one.

### `/party kick usernames:<names>`

Host-only command to remove members by comma-separated Discord usernames.

Rules:

- User must be in a party.
- User must be host.
- Cannot kick the host through this path.

After kicking:

- Removes matching members.
- DMs kicked users a notification.
- Replies with kicked count.
- Refreshes cards.

### `/party show [dm]`

Shows the user's current party card.

Behavior:

- In servers, `dm:true` sends the card by DM and replies ephemerally.
- In servers, default sends card to the channel.
- In DMs, sends the card in the DM.
- Stores the card message in the party `cards` array.

### `/party ping role:<group> [extra] [time]`

Pings one configured server ping group for the user's party or general event.

Autocomplete:

- `role`: server ping group names.
- `time`: parsed time suggestions through `chrono-node`.

Rules:

- Must be used in a server.
- Ping group must exist.
- If `allowedRoles` is empty, anyone can ping it.
- If `allowedRoles` is set, the user must have at least one allowed role.

Content:

- Without a party: `<group name> ping from <user>`.
- With a party: `(<group name>) <party name> is happening!`
- Adds `extra` text when supplied.
- Adds join-code note when user is in a party.

Scheduling:

- Requires the user to configure `/timezone set` first.
- Natural-language times are parsed in the user's saved timezone.
- If `time` is supplied, schedules a role ping with `setTimeout`.
- Scheduled pings must be in the future.
- Scheduled pings must be within 24 days.
- Scheduled jobs are memory-only and do not survive process restarts.

Dock integration:

- Immediate `/party ping` stores short-lived `client.dockPingMetadata` for the sent message so Dock relays can attach ping context.

### `/party lfg extra:<text> [time]`

Pings the server's configured LFG role.

Rules:

- Reads `lfgRoleId` from `serverSettings`.
- If no LFG role exists, replies ephemerally.
- Uses a process-wide cooldown of 10 hours.

Content:

- Without a party: LFG role plus user is looking for a group.
- With a party: LFG role plus party name is looking for members.
- Adds `extra` text.
- Adds join code when user is in a party.

Scheduling is the same memory-only scheduling used by `/party ping`.

### `/party browse [search]`

Legacy command.

It no longer browses parties. It replies ephemerally that Docks replaced the old party browser and points users to `/dock browse`, `/dock publish`, and `/dock help`.

## Party Text Commands

### `!a`

Party announcement command in normal messages.

Rules:

- User must be in a party.
- Message must start with `!a`.
- Empty announcements with no attachments or embeds are ignored.

Behavior:

- DMs every party member.
- Sends content as `Announcement author` plus message body.
- Includes source embeds and attachments.
- Reacts to the original message after sending.

### Party Tip

After creating or joining a party, the bot DMs the user a tip explaining `!a`.

## Settings Commands

Top-level command: `/settings`

### `/settings help`

Explains server-only settings:

- Ping groups.
- Ping role.
- Allowed roles.
- Keywords.
- Keyword ping toggle.
- LFG role.
- Notes that Dock ping roles are separate.

### `/settings ping add`

Requires `Manage Server`.

Inputs:

- `name`: ping group name.
- `pingrole`: role to mention.
- `allowedroles`: optional role allowed to use the group.
- `keywords`: optional comma-separated keyword list.

Behavior:

- Rejects duplicate names.
- Adds the ping group.
- Enables keyword pings if keywords are provided.

### `/settings ping remove`

Requires `Manage Server`.

Inputs:

- `name`: ping group name, with autocomplete.

Behavior:

- Removes the group.
- Errors if it does not exist.

### `/settings ping edit`

Requires `Manage Server`.

Inputs:

- `name`: existing group, with autocomplete.
- `newname`: optional.
- `pingrole`: optional replacement ping role.
- `allowedroles`: optional role to append to allowed roles.
- `keywords`: optional replacement keyword list.

Behavior:

- Requires at least one field to update.
- Shows a diff container after updating.
- Enables keyword pings if new keywords are provided.

### `/settings ping list`

Requires `Manage Server`.

Shows every configured group with:

- Ping role.
- Allowed roles.
- Keywords.

### `/settings keywordpings enabled:<true|false>`

Requires `Manage Server`.

Enables or disables keyword matching for all server ping groups.

### `/settings lfgrole role:<role>`

Sets the server LFG role used by `/party lfg`.

Current implementation note: unlike the other settings commands, this command does not currently check `Manage Server`.

## Dock Commands

Top-level command: `/dock`

Dock commands require a Discord server context. Most management commands require `Manage Channels`.

### `/dock help`

Explains:

- What Docks are.
- Follower levels.
- Browse/publish/manage commands.
- Ban/unban commands.
- Permission and ping-role separation.

### `/dock publish`

Requires `Manage Channels`.

Opens the Dock publish modal.

Modal fields:

- Dock name, max 150 chars.
- Channel select, 1 to 10 text or announcement channels.
- Dock description, optional, max 500 chars.
- Ping keywords, optional, up to 25 keywords and 500 chars.
- Dock visibility:
  - Open - All messages.
  - Open - Manual with `!p`.
  - Request To Join - All messages.
  - Request To Join - Manual with `!p`.

Validation:

- Bot must have required permissions in selected channels.
- A selected channel cannot already be a source channel for another Dock.
- A selected channel cannot already be following another Dock.
- Keywords are limited to 25.

After publishing:

- Creates a Dock.
- Creates a self-follow record for the publishing server.
- Tells the user to use `/dock manage` for ping roles, default permission levels, and more.

### `/dock browse [search]`

Requires `Manage Channels`.

Shows all published Docks, three per page.

Search matches:

- Dock name.
- Dock description.
- Publisher/server name.
- Source channel names.

Each Dock display can show:

- Name.
- Publisher.
- Follower count.
- Official flag.
- Description.
- Channels.
- Default level.
- Keywords.
- Follow button.

Follow button states:

- `Follow`
- `Request To Follow`
- `Published Here`
- `Following`
- `Request Pending`
- A banned server sees a disabled-looking flow and is blocked on click.

Developer users also see Make Official and Delete controls.

### `/dock manage [search]`

Requires `Manage Channels`.

Shows Docks this server publishes or follows.

Modes:

- Manage Published.
- Manage Followed.

Published Dock actions:

- Edit Dock.
- Server Settings.
- Manage Followers.
- Delete.

Followed Dock actions:

- Server Settings.
- Manage Followers if this server has admin access.
- Unfollow.

Edit Dock changes the shared published Dock. Server Settings changes this server's receiving and
keyword-ping configuration; publishing servers use it for their own local ping configuration.

Management pages are stored in memory by user id and expire when process memory is lost.

### `/dock ban follower:<server>`

Requires `Manage Channels`.

Autocomplete includes:

- Existing followers of this server's published Docks.
- Other guilds the bot can see that are not already banned.

Behavior:

- Opens a reason modal.
- Creates a server-wide ban from this publisher's Docks.
- Marks matching follow records as banned.
- Relays a ban alert to the Dock network.

Cannot ban the current server.

### `/dock unban follower:<server>`

Requires `Manage Channels`.

Autocomplete includes banned servers.

Behavior:

- Removes the server ban.
- Unbans matching follow records.
- Relays an unban alert to the owner and target guild.

## Dock Follow Flow

When a server clicks Follow:

1. The bot blocks the action if the follower server is banned.
2. The bot opens the Dock follow modal.
3. User selects one receiving channel.
4. If the Dock has keywords, user can map selected keywords to roles.
5. Bot verifies required permissions.
6. Bot creates/updates the Dock follow record.

Open Dock:

- Follower immediately receives the Dock default access level.
- Bot relays a follow alert to the publisher, follower, and admin followers.

Request-to-join Dock:

- Follower is saved with `level: "no-access"`.
- Bot relays an approval request to the publisher and admin followers.
- Request can mention a gatekeeper role if configured.
- Approving sets the follower to the Dock default level.
- Denying removes the follow record.

## Dock Server Settings

Publishing and following servers can configure their local Dock settings from `/dock manage`.

This modal can:

- Select a receiving channel when following another server's Dock.
- Restrict who can trigger Dock keyword pings to selected Host Roles; an empty selection allows everyone.
- Map Dock keywords to local roles.
- Toggle whether a publishing server pings itself when its own messages match Dock keywords.
- Set the publishing server's gatekeeper role.

Follower servers can configure receiving channel and keyword roles for followed Docks.

## Dock Follower Management

The follower manager shows followers three per page.

For each follower:

- Shows server name.
- Shows current level or ban status.
- Lets managers set the follower level.

Changing a level:

- Updates the follow record.
- Relays an access-change alert to publisher and follower.
- Sends an ephemeral confirmation.

Default follower level can also be changed. New request approvals/open follows use that level.

## Dock Message Relay

Relay module: `src/modules/dockRelay.js`

Message relay supports:

- Normal text.
- Embeds.
- Attachments/files.
- Discord forwarded message snapshots.
- Components.
- Replies with jump-link embeds.
- Webhook usernames that include author, Dock name, and source server.

Messages are sent with a per-channel Dock webhook named `Sailors Lodge Dock Webhook`.

Relay concurrency is capped at 4 parallel jobs.

### Automatic Relay

For Docks with `publishMode: "all"`:

- Normal messages in Dock-connected channels are relayed automatically.
- A sending follower must be able to read and send.
- The publisher can send to its own Dock.

### Manual Relay

For Docks with `publishMode: "manual"`:

- `!p text` publishes that text.
- Replying with `!p` publishes the replied-to message.

If a channel can send to multiple Docks, the bot asks the message author to choose targets. The choice is remembered for 5 minutes per user, guild, and source channel.

### Party Card Relay

Party cards are detected by their `party-join`, `party-leave`, or `party-card-refresh` button ids.

Rules:

- Private parties do not relay.
- Party cards are rebuilt and sent as Components V2 messages in follower channels.
- Relayed party cards are stored as party card messages so they refresh with the party.
- Relayed party card message ids are remembered for one hour to prevent relay loops.
- If possible, the bot starts a thread from the party card and relays that thread.

### Keyword Pings

Two keyword systems exist:

- Server ping group keywords from `/settings ping`.
- Dock keywords from `/dock publish`.

Keyword matching:

- Lowercases the text.
- Matches full words/phrases using whitespace boundaries.
- Works on message content and forwarded snapshots.

Server ping group keywords:

- Reply in the source server with configured server roles.

Dock keywords:

- Require the sending follower to be contributor or higher, unless the sender is the Dock publisher.
- Require one of the sending server's configured Host Roles when that list is not empty.
- Look up each receiving follower's `keywordPings`.
- May ping receiving roles when relaying the message.
- May include a one-hour voice-channel invite for other servers when the sending server enables `shareVoiceInvites` in the dashboard.
- Can create a thread for Dock ping discussion.

### Replies

When a relayed message replies to another message:

- The bot tries to resolve whether the reply target is a root message or a delivery copy.
- It links to the matching counterpart in the receiving server when possible.
- Otherwise it links to the original source message.

### Edits

`messageUpdate` updates relayed webhook copies when the root message changes.

Party cards are ignored by this edit path because party cards are refreshed through party state.

### Deletes

`messageDelete` deletes relayed webhook copies when the root message is deleted.

### Threads

`threadCreate` relays new threads from Dock-connected channels.

Rules:

- Threads with the `[Relayed]` prefix are ignored to prevent loops.
- If a parent channel can send to multiple Docks, the bot uses target memory or prompts for target Docks.
- Relayed threads are named `[Relayed] <original thread name>`.
- Thread messages are bridged between every visible endpoint in the Dock network.
- Starter/recent thread messages are relayed after a thread bridge is created.

## Developer Announcement

Text command: `!devannounce`

Rules:

- User id must be in `DEV_IDS`.
- Command must reply to the message being published.

Behavior:

- Builds an official announcement embed.
- Sends to every readable Dock follower channel, deduped by channel id.
- Includes source content, embeds, and attachments.
- Reacts with success or warning.
- Replies with count of Docks reached.

## Events

### `ClientReady`

Logs the logged-in bot tag.

### `GuildCreate`

When the bot joins a server:

- Fetches recent Bot Add audit logs.
- Finds who added the bot.
- DMs that user a welcome guide covering parties, Docks, settings, and DM requirements.

### `InteractionCreate`

Handles:

- Autocomplete.
- Bug report modal submissions.
- Party create/edit modal submissions.
- Dock publish/follow/ping/default-level/ban modals.
- Party buttons.
- Dock browse/manage pagination and search.
- Dock follow/configure/unfollow/delete/official buttons.
- Dock follower access-level menus.
- Dock follow request approve/deny buttons.
- Dock target picker menus.
- Normal slash command execution.

Errors:

- Autocomplete errors are captured and return an empty list.
- Command errors are reported to Sentry unless they are missing-access errors.
- Users get an ephemeral error id and report button when possible.

### `MessageCreate`

Handles:

- `!devannounce`.
- `!a` party announcements.
- Dock relay routing.
- Dock keyword pings.
- Manual `!p` publishing.
- Dock target selection prompts.
- Party card relay.

### `MessageUpdate`

Updates webhook delivery copies for relayed root messages.

### `MessageDelete`

Deletes webhook delivery copies for relayed root messages.

### `ThreadCreate`

Relays threads from Dock-connected channels.

## Error Handling and Reporting

Sentry setup:

- Enabled when `SENTRY_DSN` exists and `NODE_ENV` is not `test`.
- Strips user data, cookies, request data, headers, and query strings.
- Captures `console.error`.
- Samples traces at 100 percent in development and 10 percent otherwise, while skipping health/root requests.

`src/reportError.js` provides:

- `captureError`
- `notifyUser`
- `reportError`
- `buildReportErrorComponents`

User-facing error notices:

- Include a 32-character Sentry event id.
- Include a Report error button.
- Open a bug report modal prefilled with the error id.

Missing Dock permissions:

- `dockRelay.reportDockRelayError` detects missing permissions/access.
- `dockBotPerms.sendMissingPermissionNotice` posts a throttled notice in the affected channel/thread or DMs the user.
- Notice cooldown is 10 minutes per target and permission set.

## Required Bot Permissions for Docks

Checked by `src/modules/dockBotPerms.js`:

- View Channel.
- Send Messages.
- Read Message History.
- Manage Webhooks.
- Mention Everyone / mention all roles.
- Send Messages in Threads.
- Manage Threads.
- Create Public Threads.

The bot checks these when publishing/following Docks and reports missing permissions during relay failures.

## Utility Modules

- `announce.js`: DMs a payload to every party member.
- `chunkArray.js`: chunks arrays for paginated UI.
- `dockBotPerms.js`: Dock permission checks and missing-permission notices.
- `dockBrowsePage.js`: builds Dock browse UI.
- `dockConfig.js`: validates Dock/follow input.
- `dockDefaultLevelModal.js`: modal for default follower access.
- `dockFollowModal.js`: modal for receiving channel, Host Roles, and keyword roles.
- `dockLevels.js`: access-level model and helpers.
- `dockManagePage.js`: builds Dock management UI.
- `dockModerationAutocomplete.js`: autocomplete for manageable Docks and ban/unban targets.
- `dockPublishModal.js`: modal for Dock creation/editing.
- `dockRelay.js`: webhook relay, alert relay, party-card relay, reply mapping, thread relay.
- `dockTargetPicker.js`: target selector and 5-minute route memory for multi-Dock channels.
- `durationToMilliseconds.js`: parses simple `10s`, `5m`, `2h`, `1d` durations.
- `editParty.js`: host party edit helper.
- `escapeMarkdown.js`: escapes Discord markdown/control characters.
- `fetchChannel.js`: cache-first channel fetch.
- `fetchUserFromId.js`: fetches a Discord user.
- `formatMilliseconds.js`: formats milliseconds as days/hours/minutes/seconds.
- `getDockDisplay.js`: shared Dock display renderer.
- `joinParty.js`: party join flow.
- `leaveParty.js`: party leave and host transfer flow.
- `manageFollowersPage.js`: Dock follower management renderer.
- `mapWithConcurrency.js`: concurrency-limited async mapper.
- `matchesSearch.js`: normalized phrase/term search.
- `mentions.js`: formats role mentions.
- `partyConfigModal.js`: party create/edit modal.
- `renderPartyCard.js`: party card renderer.
- `schedulePing.js`: memory-only scheduled role pings.
- `sendPartyNotification.js`: DMs party state notifications.
- `sendPartyTip.js`: DMs the `!a` tip.
- `serverSettings.js`: validates and updates ping group/settings data.
- `subcommandFolder.js`: builds top-level slash commands from subcommand files.
- `timeFiltering.js`: autocomplete and parsing for scheduled times.
- `uniqueItems.js`: deduplicates arrays.
- `updateDockBrowsePage.js`: refreshes browse interaction state.
- `updateDockManagePage.js`: refreshes management interaction state.
- `updatePartyCards.js`: edits all tracked party cards.

## UX and Access Rules

General:

- Most setup and management responses are ephemeral.
- Party cards and Dock pages use Discord Components V2.
- Party notifications and announcements depend on user DMs being open.

Party:

- One active party per user.
- Only host can edit/delete/kick.
- Host leaving transfers leadership to the first remaining member.
- Empty host-leave deletes the party.
- Deleted parties are retained as soft-deleted records.

Settings:

- Ping group management requires `Manage Server`.
- Keyword ping toggle requires `Manage Server`.
- LFG role setting currently has no explicit permission check.

Docks:

- Publishing, browsing, managing, banning, and unbanning require `Manage Channels`.
- Dock publish/follow channels must not conflict with source/follow relationships that would create confusing loops.
- Followers can receive multiple Docks in one channel.
- Source channels cannot also be receiving channels for another Dock.
- Request-only Docks use `no-access` until approval.
- Dock bans are server-wide per publisher guild.

## Known Operational Limits

- Scheduled pings are stored only in process memory and disappear on restart.
- Dock browse/manage page state is stored only in process memory.
- Dock target routing memory lasts 5 minutes.
- Dock webhook cache lasts 10 minutes.
- Relayed party-card loop prevention lasts 1 hour.
- The LFG cooldown is process-wide and memory-only.
- Party join codes are random six-digit numeric strings with no collision retry.
- MongoDB must be initialized before events can safely use modules; event wrapper waits for `db.ready`.

## What Is Not Covered Here

This file does not document:

- `dashboard/`
- `src/server/`
- `index.html`
- Vite, React, Tailwind, or shadcn UI code.
- Landing-page behavior.
