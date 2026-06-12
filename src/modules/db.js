const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const mongoUri = process.env.MONGO_URI;
const devMode = process.env.DEV_MODE === 'true';

const mongoClient = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
const PARTY_TTL_DAYS = 3;
const PARTY_TTL_MS = PARTY_TTL_DAYS * 24 * 60 * 60 * 1000;
const PARTY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly

// init db 
async function initDb() {
  await mongoClient.connect();
  const mongoDbName = devMode ? "development" : "production";
  db = mongoClient.db(mongoDbName);
  // await migrateServerSettings();
  await deleteExpiredParties();
  startPartyCleanupScheduler();
}

initDb();
// ---------- COLLECTION HELPER ----------
function getCollection(collectionName) {
  return db.collection(collectionName);
}

// get settings
async function getSettings(guildId) {
  const serverSettings = getCollection("serverSettings");
  let settings = await serverSettings.findOne({ guildId });
  if (!settings) {
    settings = {
      guildId,
      pingGroups: [],
      keywordPingsEnabled: true,
    };
    await serverSettings.insertOne(settings);
  }
  return settings;
}

// async function migrateServerSettings() { // this function is written by chatgpt lol
//   const migrations = getCollection("migrations");
//   const migrationId = "keyword-pings-schema-v1";
//   const existingMigration = await migrations.findOne({ _id: migrationId });
//   if (existingMigration) return;

//   const serverSettings = getCollection("serverSettings");
//   const settings = await serverSettings.find().toArray();
//   let migratedCount = 0;

//   for (const server of settings) {
//     const update = { $set: {}, $unset: {} };
//     const existingPingGroups = Array.isArray(server.pingGroups) ? server.pingGroups : [];
//     const hasKeywordConfig = existingPingGroups.some((group) =>
//       group.keywordChannelId ||
//       group.followedChannelId ||
//       (Array.isArray(group.keywords) && group.keywords.length > 0) ||
//       (Array.isArray(group.followedKeywords) && group.followedKeywords.length > 0)
//     );

//     if (typeof server.keywordPingsEnabled !== "boolean") {
//       update.$set.keywordPingsEnabled =
//         typeof server.followedPingsEnabled === "boolean"
//           ? server.followedPingsEnabled
//           : true;
//     } else if (server.keywordPingsEnabled === false && hasKeywordConfig && !("followedPingsEnabled" in server)) {
//       update.$set.keywordPingsEnabled = true;
//     }

//     if ("followedPingsEnabled" in server) {
//       update.$unset.followedPingsEnabled = "";
//     }

//     if (!Array.isArray(server.pingGroups)) {
//       update.$set.pingGroups = [];
//     } else {
//       const pingGroups = server.pingGroups.map((group) => {
//         const next = { ...group };

//         if (!("keywordChannelId" in next) && "followedChannelId" in next) {
//           next.keywordChannelId = next.followedChannelId;
//         }

//         if (!("keywords" in next) && "followedKeywords" in next) {
//           next.keywords = next.followedKeywords;
//         }

//         delete next.followedChannelId;
//         delete next.followedKeywords;

//         if (!Array.isArray(next.keywords)) {
//           next.keywords = [];
//         }

//         return next;
//       });

//       if (JSON.stringify(pingGroups) !== JSON.stringify(server.pingGroups)) {
//         update.$set.pingGroups = pingGroups;
//       }
//     }

//     if (!Object.keys(update.$set).length) delete update.$set;
//     if (!Object.keys(update.$unset).length) delete update.$unset;
//     if (!Object.keys(update).length) continue;

//     await serverSettings.updateOne({ _id: server._id }, update);
//     migratedCount++;
//   }

//   if (migratedCount > 0) {
//     console.log(`[db] Migrated ${migratedCount} server settings document${migratedCount === 1 ? "" : "s"}.`);
//   }

//   await migrations.updateOne(
//     { _id: migrationId },
//     { $set: { ranAt: new Date() } },
//     { upsert: true },
//   );
// }

// set settings
async function setSettings(guildId, settings) {
  // {
  //         bsonType: "object",
  //         required: ["guildId"],
  //         properties: {
  //           guildId:              { bsonType: "string" },
  //           lfgRoleId:            { bsonType: "string" },
  //           keywordPingsEnabled: { bsonType: "bool" },
  //           pingGroups: {
  //             bsonType: "array",
  //             items: {
  //               bsonType: "object",
  //               required: ["name", "pingRoleId"],
  //               properties: {
  //                 name:           { bsonType: "string" },
  //                 pingRoleId:     { bsonType: "string" },
  //                 allowedRoleIds: { bsonType: "array", items: { bsonType: "string" } },
  //                 keywordChannelId: { bsonType: "string" },
  //                 keywords: { bsonType: "array", items: { bsonType: "string" } },
  //               }
  //             }
  //           }
  //         }
  //       }

  const serverSettings = getCollection("serverSettings");
  const settingsToSet = { ...settings };
  delete settingsToSet._id;
  delete settingsToSet.guildId;

  // Only update provided fields; leave others untouched.
  await serverSettings.updateOne(
    { guildId },
    { $set: settingsToSet },
    { upsert: true }
  );

  return serverSettings.findOne({ guildId });
}

// create party
async function createParty(name, description = "", status = "not-started", visibility, memberLimit, host) {
  const parties= getCollection("parties");
  const joinCode = Array.from(
    { length: 6 },
    () =>
      "0123456789"[
        Math.floor(Math.random() * 10)
      ]
  ).join("");

  const partyData = {
    name,
    description,
    status,
    visibility,
    memberLimit,
    host,
    members: [host],
    joinCode,
    createdAt: new Date(),
  };

  const result = await parties.insertOne(partyData);

  return {
    _id: result.insertedId,
    ...partyData,
  }
}

async function getPartyFromJoinCode(joinCode) {
  const parties = getCollection("parties");
  return parties.findOne({ joinCode: joinCode.toString() });
}

async function getParty(partyId) {
  const parties = getCollection("parties");
  return parties.findOne({ _id: partyId });
}

async function updateParty(partyId, update, interaction) { // Also updates all partyCard discord messages
  const parties = getCollection("parties");

  if (!Object.keys(update).some((k) => k.startsWith("$"))) {
    throw new Error("updateParty requires MongoDB operators ($set, $push, etc)");
  }

  await parties.updateOne({ _id: partyId }, update);

  // Fetch the actual updated document
  const party = await getParty(partyId);
  return party
}


async function addPartyCardMessage(partyId, card) {
  const parties = getCollection("parties");
  return parties.updateOne({ _id: partyId }, { $push: { cards: card } });
}

async function deleteParty(partyId, interaction) {
  await updateParty(partyId, { $set: { members: [] } }, interaction);
  await updateParty(partyId, { $set: { deleted: true } }, interaction);
}

async function deleteExpiredParties() {
  const parties = getCollection("parties");
  const cutoff = new Date(Date.now() - PARTY_TTL_MS);
  const cutoffObjectId = ObjectId.createFromTime(Math.floor(cutoff.getTime() / 1000));

  const expiredParties = await parties.find({
    deleted: { $ne: true },
    $or: [
      { createdAt: { $lte: cutoff } },
      { createdAt: { $exists: false }, _id: { $lte: cutoffObjectId } },
    ],
  }).toArray();

  if (!expiredParties.length) return 0;

  for (const party of expiredParties) {
    await deleteParty(party._id);
  }

  return expiredParties.length;
}

function startPartyCleanupScheduler() {
  setInterval(() => {
    deleteExpiredParties().catch((err) => {
      console.error("[party-cleanup] Failed to delete expired parties:", err);
    });
  }, PARTY_CLEANUP_INTERVAL_MS);
}

async function removeMembersFromParty(partyId, memberIds, interaction) {
  const party = await getParty(partyId);

  // Remove the member(s) by matching their id
party.members = party.members.filter((m) => !memberIds.includes(m.id));

  console.log(party.members); // should no longer include the removed member

  return await updateParty(party._id, { $set: { members: party.members } }, interaction);

}



async function getParties(filters = {}) {
  const parties = getCollection("parties");

  // Define mandatory constraints
  const baseQuery = {
    deleted: { $ne: true },
    status: { $ne: "active" },
    members: { $type: "array", $ne: [] },
    memberLimit: { $type: "number" },
    $expr: { $lt: [{ $size: "$members" }, "$memberLimit"] },
  };

  // Merge custom filters into the base query
  const finalQuery = { ...baseQuery, ...filters };

  // Use the [MongoDB find() method](www.mongodb.com)
  return parties.find(finalQuery).toArray();
}

async function getCurrentParty(userId) {
  const parties = getCollection("parties");
  return parties.findOne({ members: { $elemMatch: { id: userId } } });
}

async function removePartyCardMessage(messageId) { 
  const parties = getCollection("parties");
  return parties.updateOne({ cards: { $elemMatch: { messageId } } }, { $pull: { cards: { messageId } } });
}


// **Replace `/party browse` with Party Feed System**

// ## Background
// `/party browse` shows a list of parties that haven't started yet, which would theoretically be useful. But the core problem is that it requires players to repeatedly check for parties. AO party culture is built around passive pinging-and-waiting behavior, not a lobby browser, so browse stays empty and nobody has a reason to use it.

// The feed system flips this: parties come to the player instead.

// ---

// ## How it works

// ### Server side (feed source)
// - Server owner runs `/feed publish #channel-name`
// - A modal prompts them for a feed title, description, and configuration options
// - Their server + channel is added to the Feed Directory with a unique `source` ID
// - Messages are forwarded to subscribers based on the server owner's configured publish mode (see Feed Configuration below)
// - If a party is set to Private visibility, it is never forwarded regardless of publish mode

// ### Player side (subscriber)
// - Player runs `/feed browse` to open the feed directory (only shows feeds with directory visibility enabled)
// - They see a list of registered feed channels across all servers (e.g. "Party Central — #luck-parties", "Party Central — #omen-hunts")
// - They hit Subscribe on any feed they want, or use `/feed subscribe <source>` to subscribe directly
// - If a subscription request is required, the server owner is notified and must approve before the subscription is active
// - If subscribing in a server channel, the player is prompted to pick a channel to pipe the feed into and optionally configure a ping role
// - If subscribing in DMs, they receive forwarded messages as DM notifications
// - `/party create` cards are always forwarded as full interactive party cards with a join button

// ---

// ## Feed Configuration
// Server owners can configure the following options per feed when running `/feed publish` or later via `/feed edit`:

// ### Feed Visibility
// **Open**
// Open — All messages — anyone can follow instantly, every message is forwarded
// Open — Keywords only — anyone can follow instantly, only keyword-matching messages are forwarded
// Open — Manual only — anyone can follow instantly, only /party create cards are forwarded
// **Request To Join**
// Request — All messages — server owner must approve follow requests, every message is forwarded
// Request — Keywords only — server owner must approve follow requests, only keyword-matching messages are forwarded
// Request — Manual only — server owner must approve follow requests, only /party create cards are forwarded

// ---

// ## Changes
// - [x] Add `feedSources` collection (`source` as primary identifier, server id, channel id, title, description, publish mode, keywords, directory visibility, subscription mode)
// - [x] Add `feedSubscribers` collection (source, subscriber id, type: dm or channel)
// - [x] Add `/feed publish` command with modal 
// - [x] Add `/feed browse` command displaying the public feed directory with subscribe buttons
// - [x] Add `/feed edit` command for server owners to view, edit, and remove their feed sources
// - [ ] Add `/feed subscribe <source>` command for direct subscription via feed ID
// - [ ] Forward messages to feed subscribers based on configured publish mode on every message sent in a registered feed channel
// - [ ] Forward full interactive party card to subscribers when `/party create` is used in a registered feed channel
// - [ ] Skip forwarding for private parties
// - [ ] Handle subscription request flow — notify server owner, await approval before activating subscription
// - [x] Remove `/party browse` command
// - [ ] Add onboarding message when bot is added explaining how the bot works and encouraging hosts to register feed channels
// - [ ] Add disclaimer footer to party cards clarifying it is a Discord coordination group, not an in-game party
// - [ ] Update `/party create` to include optional `ping` parameter that triggers a configured ping group on creation

// ## Breaking Changes
// - `/party browse` is removed. All references in help text, onboarding messages, and documentation must be updated.

// note: `source` is only in feedSubscribers table, while feedSources uses _id. Both are the same 

async function getFeedSources() {
  const feedSources = getCollection("feedSources");
  return feedSources.find({}, { projection: { guildName: 0, channelNames: 0 } }).toArray();
}

async function getFeedSource(sourceId) {
  const feedSources = getCollection("feedSources");
  return feedSources.findOne(
    { _id: new ObjectId(sourceId) },
    { projection: { guildName: 0, channelNames: 0 } },
  );
}

const getFeedSourcesFromChannelId = async (channelId) => {
  // channelIds is an array of channel ids
  const feedSources = getCollection("feedSources");
  return feedSources.find(
    { channelIds: channelId },
    { projection: { guildName: 0, channelNames: 0 } },
  ).toArray();
}

async function getFeedSubscribers(sourceId) {
  const feedSubscribers = getCollection("feedSubscribers");
  return feedSubscribers.find({ source: new ObjectId(sourceId) }).toArray();
}

async function getManyFeedSubscribers(sourceIds) {
  const feedSubscribers = getCollection("feedSubscribers");
  return feedSubscribers.find({ source: { $in: sourceIds } }).toArray();
}

async function publishFeedSource(
  name,
  guildId,
  channelIds,
  description = "",
  keywords = [],
  publishMode = "manual",
  subscriptionMode = "open",
) {
  const feedSources = getCollection("feedSources");
  return feedSources.insertOne({
    name,
    guildId,
    channelIds,
    description,
    keywords,
    publishMode,
    subscriptionMode,
    createdAt: new Date(),
  });
}

async function updateFeedSource(sourceId, update) {
  const feedSources = getCollection("feedSources");

  if (!Object.keys(update).some((key) => key.startsWith("$"))) {
    throw new Error("updateFeedSource requires MongoDB operators ($set, $push, etc)");
  }

  await feedSources.updateOne({ _id: new ObjectId(sourceId) }, update);
  return getFeedSource(sourceId);
}

async function removeFeedSource(sourceId) {
  const feedSources = getCollection("feedSources");
  await feedSources.deleteOne({ _id: new ObjectId(sourceId) });
  const feedSubscribers = getCollection("feedSubscribers");
  return feedSubscribers.deleteMany({ source: new ObjectId(sourceId) });
}

async function addSubscriber(sourceId, userId, channelId = null, pingRoleIds = []) {
  const feedSubscribers = getCollection("feedSubscribers");
  return feedSubscribers.insertOne({
    source: new ObjectId(sourceId),
    userId,
    channelId,
    type: channelId ? "channel" : "dm",
    pingRoleIds,
  });
}

async function removeSubscriber(sourceId, userId) {
  const feedSubscribers = getCollection("feedSubscribers");
  return feedSubscribers.deleteOne({ source: new ObjectId(sourceId), userId });
}

async function getSubscriber(sourceId, userId) {
  const feedSubscribers = getCollection("feedSubscribers");
  return feedSubscribers.findOne({ source: new ObjectId(sourceId), userId });
}


module.exports = {
  getSettings,
  setSettings,
  getParties,
  initDb,
  getCollection,
  createParty,
  getParty,
  updateParty,
  getPartyFromJoinCode,
  addPartyCardMessage,
  getCurrentParty,
  removeMembersFromParty,
  deleteParty,
  deleteExpiredParties,
  removePartyCardMessage,
  getFeedSources,
  getFeedSource,
  getFeedSubscribers,
  publishFeedSource,
  updateFeedSource,
  removeFeedSource,
  addSubscriber,
  removeSubscriber,
  getSubscriber,
  getFeedSourcesFromChannelId,
  getManyFeedSubscribers,
};
