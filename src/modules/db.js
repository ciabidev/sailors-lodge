const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dockLevels = require("./dockLevels");
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
let initPromise;
let cleanupSchedulerStarted = false;
const PARTY_TTL_DAYS = 7;
const PARTY_TTL_MS = PARTY_TTL_DAYS * 24 * 60 * 60 * 1000;
const PARTY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly

// init db 
async function initDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await mongoClient.connect();
    const mongoDbName = devMode ? "development" : "production";
    db = mongoClient.db(mongoDbName);
    // await migrateServerSettings();
    await deleteExpiredParties();
    if (!cleanupSchedulerStarted) {
      startPartyCleanupScheduler();
      cleanupSchedulerStarted = true;
    } 
    await migrateDockFollowsCollection();
    await migrateDockFollowers();
    await migrateDockDefaultLevels()
    console.log("MongoDB connected")
    return db;
  })();

  return initPromise;
}


// ---------- COLLECTION HELPER ----------
function getCollection(collectionName) {
  if (!db) {
    throw new Error(`Database has not finished initializing before accessing ${collectionName}`);
  }
  return db.collection(collectionName);
}

const ready = initDb();


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

//         if (!("keywords" in next) && "followedKeywords" in next) {
//           next.keywords = next.followedKeywords;
//         }

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
async function migrateDockFollowsCollection() {
  const migrationClient = new MongoClient(mongoUri);

  try {
    await migrationClient.connect();

    const database = migrationClient.db(devMode ? "development" : "production");

    const oldExists = await database
      .listCollections({ name: "dockServers" }, { nameOnly: true })
      .hasNext();

    const newExists = await database
      .listCollections({ name: "dockFollows" }, { nameOnly: true })
      .hasNext();

    if (oldExists && !newExists) {
      await database.collection("dockServers").rename("dockFollows");
    }
  } finally {
    await migrationClient.close();
  }
}
async function migrateDockFollowers() {
  const followers = getCollection("dockFollows");

  await followers.updateMany({ level: { $exists: false } }, [
    {
      $set: {
        level: {
          $cond: ["$contributor", "contributor", "passive"],
        },
      },
    },
  ]);

  await followers.updateMany({ contributor: { $exists: true } }, { $unset: { contributor: "" } });
  await followers.updateMany(
    { level: { $nin: dockLevels.order } },
    { $set: { level: dockLevels.DEFAULT_LEVEL } },
  );
}

async function migrateDockDefaultLevels() {
  const docks = getCollection("docks");

  await docks.updateMany(
    { defaultLevel: { $nin: dockLevels.order } },
    { $set: { defaultLevel: dockLevels.DEFAULT_LEVEL } },
  );
}
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
  return parties.updateOne({ _id: new ObjectId(partyId) }, { $push: { cards: card } });
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


// **Replace `/party browse` with Party Docks**

// ## Background
// `/party browse` shows a list of parties that haven't started yet, which would theoretically be useful. But the core problem is that it requires players to repeatedly check for parties. AO party culture is built around passive pinging-and-waiting behavior, not a lobby browser, so browse stays empty and nobody has a reason to use it.

// Docks flip this: parties come to the player instead.

// ---

// ## How it works

// ### Publisher side (dock)
// - Dock owner runs `/dock publish #channel-name`
// - A modal prompts them for a dock title, description, and configuration options
// - Their publisher + channel is added to the Dock Directory with a unique dock ID
// - Messages are forwarded to followers based on the dock owner's configured publish mode
// - If a party is set to Private visibility, it is never forwarded regardless of publish mode

// ### Follower side (dock follower)
// - Player runs `/dock browse` to open the dock directory
// - They see a list of registered dock channels across all publishers (e.g. "Party Central — #luck-parties", "Party Central — #omen-hunts")
// - They follow any dock they want
// - If following requires approval, the dock owner is notified and must approve before the follower is active
// - When following a Dock, the player is prompted to pick a channel to pipe the dock into and optionally configure a ping role
// - If subscribing in DMs, they receive forwarded messages as DM notifications
// - `/party create` cards are always forwarded as full interactive party cards with a join button

// ---

// ## Dock Configuration
// Dock owners can configure the following options per dock when running `/dock publish` or later via `/dock edit`:

// ### Dock Visibility
// **Open**
// Open — All messages — anyone can follow instantly, every message is forwarded
// Open — Keywords only — anyone can follow instantly, only keyword-matching messages are forwarded
// Open — Manual only — anyone can follow instantly, only /party create cards are forwarded
// **Request To Join**
// Request — All messages — dock owner must approve follow requests, every message is forwarded
// Request — Keywords only — dock owner must approve follow requests, only keyword-matching messages are forwarded
// Request — Manual only — dock owner must approve follow requests, only /party create cards are forwarded

// ---

// ## Changes
// - [x] Add `docks` collection (publisher id/name, channel ids, title, description, publish mode, keywords, directory visibility, access mode)
// - [x] Add `dockFollows` collection (dock id, follower id/name, receiving channels, ping roles)
// - [x] Add `/dock publish` command with modal
// - [x] Add `/dock browse` command displaying the public dock directory with follow buttons
// - [x] Add `/dock edit` command for dock owners to view, edit, and remove their docks
// - [ ] Forward messages to dock followers based on configured publish mode on every message sent in a registered dock channel
// - [ ] Forward full interactive party card to dock followers when `/party create` is used in a registered dock channel
// - [ ] Skip forwarding for private parties
// - [ ] Handle request-to-join flow — notify dock owner, await approval before activating the follower
// - [x] Remove `/party browse` command
// - [ ] Add onboarding message when bot is added explaining how the bot works and encouraging hosts to register dock channels
// - [ ] Add disclaimer footer to party cards clarifying it is a Discord coordination group, not an in-game party
// - [ ] Update `/party create` to include optional `ping` parameter that triggers a configured ping group on creation

// ## Breaking Changes
// - `/party browse` is removed. All references in help text, onboarding messages, and documentation must be updated.

async function getDocks() {
  const docks = getCollection("docks");
  return docks.find({}, { projection: { channelNames: 0 } }).toArray();
}

async function getDock(dockId) {
  const docks = getCollection("docks");
  return docks.findOne(
    { _id: new ObjectId(dockId) },
    { projection: { channelNames: 0 } },
  );
}

const getDocksFromChannelId = async (channelId) => {
  // channelIds is an array of channel ids
  const docks = getCollection("docks");
  return docks.find(
    { channelIds: channelId },
    { projection: { channelNames: 0 } },
  ).toArray();
}



async function getDockFollowers(dockId) {
  const dockFollowers = getCollection("dockFollows");
  return dockFollowers.find({ dockId: new ObjectId(dockId) }).toArray();
}

async function getManyDockFollowers(dockIds) {
  const dockFollowers = getCollection("dockFollows");
  return dockFollowers.find({ dockId: { $in: dockIds } }).toArray();
}

async function getDockFollowsForChannel(channelId) { // channels can follow multiple docks so this needs to return all matches
  const dockFollowers = getCollection("dockFollows");
  return dockFollowers.find({ channelIds: channelId }).toArray();
}

async function createDock(
  name,
  guildId,
  guildName,
  channelIds,
  description = "",
  keywords = [],
  publishMode = "manual",
  accessMode = "open",
  defaultLevel = dockLevels.DEFAULT_LEVEL,
) {
  const docks = getCollection("docks");
  return docks.insertOne({
    name,
    guildId,
    guildName,
    channelIds,
    description,
    keywords,
    publishMode,
    accessMode,
    defaultLevel,
    createdAt: new Date(),
  });
}

async function updateDock(dockId, update) {
  const docks = getCollection("docks");

  if (!Object.keys(update).some((key) => key.startsWith("$"))) {
    throw new Error("updateDock requires MongoDB operators ($set, $push, etc)");
  }

  await docks.updateOne({ _id: new ObjectId(dockId) }, update);
  return getDock(dockId);
}

async function removeDock(dockId) {
  const docks = getCollection("docks");
  await docks.deleteOne({ _id: new ObjectId(dockId) });
  const dockFollowers = getCollection("dockFollows");
  return dockFollowers.deleteMany({ dockId: new ObjectId(dockId) });
}

async function setDockFollower(dockId, guildId, changes = {}) {
  const dockFollowers = getCollection("dockFollows");
  const dockObjectId = new ObjectId(dockId);

  const fields = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  delete fields._id;
  delete fields.dockId;
  delete fields.guildId;
  delete fields.createdAt;
  delete fields.contributor;

  if ("level" in fields && !dockLevels.isValid(fields.level)) {
    throw new Error(`Invalid Dock follower level: ${fields.level}`);
  } // to catch typos like contributer instead of contributor

  const setOnInsert = {
    dockId: dockObjectId,
    guildId,
    createdAt: new Date(),
  };
  if (!("level" in fields)) setOnInsert.level = dockLevels.DEFAULT_LEVEL;

  const update = { $setOnInsert: setOnInsert };
  if (Object.keys(fields).length) update.$set = fields;

  return dockFollowers.updateOne(
    { dockId: dockObjectId, guildId },
    update,
    { upsert: true },
  );
}

async function removeDockFollower(dockId, guildId) {
  const dockFollowers = getCollection("dockFollows");
  return dockFollowers.deleteOne({ dockId: new ObjectId(dockId), guildId });
}

async function getDockFollower(dockId, guildId) {
  const dockFollowers = getCollection("dockFollows");
  return dockFollowers.findOne({ dockId: new ObjectId(dockId), guildId });
}

async function countDockFollowers(dockId) {
  const dockFollowers = getCollection("dockFollows");
  let count = await dockFollowers.countDocuments({ dockId: new ObjectId(dockId) });
  return count;
}

async function getFollowedDocksForGuild(guildId) {
  const dockFollowers = getCollection("dockFollows");
  const dockFollowsForGuild = await dockFollowers.find({ guildId }).toArray();
  if (!dockFollowsForGuild.length) return [];

  const docks = getCollection("docks");
  const dockIds = dockFollowsForGuild.map((dockFollow) => dockFollow.dockId);

  return docks.find(
    { _id: { $in: dockIds } },
    { projection: { channelNames: 0 } },
  ).toArray();
}

async function getPublishedDocksForGuild(guildId) {
  const docks = getCollection("docks");
  return docks.find({ guildId }).toArray();
}
async function getDockWebhook(guildId) {
  const dockWebhooks = getCollection("dockWebhooks");
  return dockWebhooks.findOne({ guildId });
}

async function setDockWebhook(guildId, changes = {}) { // each follower has a singular webhook to manage all dock messages
  const dockWebhooks = getCollection("dockWebhooks");
  const fields = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  delete fields._id;
  delete fields.guildId;
  delete fields.createdAt;

  return dockWebhooks.updateOne(
    { guildId },
    {
      $set: {
        ...fields,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        guildId,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}


async function indexDockMessage({
  dockId,
  rootGuildId,
  rootChannelId,
  rootMessageId,
  deliveries = [],
}) {
  const dockMessages = getCollection("dockMessages");
  return dockMessages.updateOne(
    {rootChannelId, rootMessageId},
    {
      $setOnInsert: {
        dockId: new ObjectId(dockId),
        rootGuildId,
        rootChannelId,
        rootMessageId,
        deliveries,
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

async function getDockMessageFromRoot(rootChannelId, rootMessageId) {
  const dockMessages = getCollection("dockMessages");
  return dockMessages.findOne({rootChannelId, rootMessageId});
}

async function addDockMessageDeliveries(rootChannelId, rootMessageId, deliveries) {
  const dockMessages = getCollection("dockMessages");
  return dockMessages.updateOne(
    {rootChannelId, rootMessageId},
    {
      $push: { deliveries: { $each: deliveries } },
      $set: { updatedAt: new Date() },
    },
  );
}

async function setDockMessageDeliveries(rootChannelId, rootMessageId, deliveries) {
  const dockMessages = getCollection("dockMessages");
  return dockMessages.updateOne(
    {rootChannelId, rootMessageId},
    {
      $set: {
        deliveries,
        updatedAt: new Date(),
      },
    },
  );
}

async function removeDockMessageFromRoot(rootChannelId, rootMessageId) {
  const dockMessages = getCollection("dockMessages");
  return dockMessages.deleteOne({rootChannelId, rootMessageId});
}

async function indexDockThread({
  dockId,
  rootGuildId,
  rootChannelId,
  rootThreadId,
  name,
  deliveries = [],
}) {
  const dockThreads = getCollection("dockThreads");
  return dockThreads.updateOne(
    { rootThreadId },
    {
      $setOnInsert: {
        dockId: new ObjectId(dockId),
        rootGuildId,
        rootChannelId,
        rootThreadId,
        name,
        deliveries,
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

async function getDockThread(threadId) {
  const dockThreads = getCollection("dockThreads");
  return dockThreads.findOne({
    $or: [
      { rootThreadId: threadId },
      { "deliveries.threadId": threadId },
    ],
  });
}

async function addDockThreadDeliveries(rootThreadId, deliveries) {
  const dockThreads = getCollection("dockThreads");
  return dockThreads.updateOne(
    { rootThreadId },
    {
      $push: { deliveries: { $each: deliveries } },
      $set: { updatedAt: new Date() },
    },
  );
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
  getDocks,
  getDock,
  getDockFollowers,
  countDockFollowers,
  createDock,
  updateDock,
  removeDock,
  setDockFollower,
  removeDockFollower,
  getDockFollower,
  getFollowedDocksForGuild,
  getDockWebhook,
  setDockWebhook,
  getDocksFromChannelId,
  getManyDockFollowers,
  getDockFollowsForChannel,
  getPublishedDocksForGuild,
  indexDockMessage,
  getDockMessageFromRoot,
  addDockMessageDeliveries,
  setDockMessageDeliveries,
  removeDockMessageFromRoot,
  indexDockThread,
  getDockThread,
  addDockThreadDeliveries,
};
