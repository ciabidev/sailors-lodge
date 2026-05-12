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
      followedPingsEnabled: false,
    };
    await serverSettings.insertOne(settings);
  }
  return settings;
}

// set settings
async function setSettings(guildId, settings) {
  // {
  //         bsonType: "object",
  //         required: ["guildId"],
  //         properties: {
  //           guildId:              { bsonType: "string" },
  //           lfgRoleId:            { bsonType: "string" },
  //           followedPingsEnabled: { bsonType: "bool" },
  //           pingGroups: {
  //             bsonType: "array",
  //             items: {
  //               bsonType: "object",
  //               required: ["name", "pingRoleId"],
  //               properties: {
  //                 name:           { bsonType: "string" },
  //                 pingRoleId:     { bsonType: "string" },
  //                 allowedRoleIds: { bsonType: "array", items: { bsonType: "string" } },
  //                 followedChannelId: { bsonType: "string" },
  //                 followedKeywords: { bsonType: "array", items: { bsonType: "string" } },
  //               }
  //             }
  //           }
  //         }
  //       }

  const serverSettings = getCollection("serverSettings");
  // Only update provided fields; leave others untouched.
  await serverSettings.updateOne(
    { guildId },
    { $set: settings },
    { upsert: true }
  );

  return serverSettings.findOne({ guildId });
}

// create party
async function createParty(name, description = "", visibility, memberLimit, host) {
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
};
