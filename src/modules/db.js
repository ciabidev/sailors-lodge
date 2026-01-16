const { MongoClient, ServerApiVersion } = require("mongodb");
const { mongoUri, devMode } = require("../../config.json"); // adjust path
const join = require("../../commands/party/join");

const client = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

// init db 
async function initDb() {
  await client.connect();
  const mongoDbName = devMode ? "development" : "production";
  db = client.db(mongoDbName);
}

initDb();
// ---------- COLLECTION HELPER ----------
function getCollection(collectionName) {
  return db.collection(collectionName);
}

// get settings
async function getSettings(guildId) {
  const serverSettings = getCollection("serverSettings");
  return serverSettings.findOne({ guildId });
}

// set settings
async function setSettings(guildId, settings) {
  const serverSettings = getCollection("serverSettings");

  // Include guildId to upsert
  const fullDocument = { guildId, ...settings };

  // Upsert: replace the document if exists, insert if not
  await serverSettings.replaceOne({ guildId }, fullDocument, { upsert: true });
}

// create party
async function createParty(name, description = "", visibility, memberLimit, host) {
  const parties= getCollection("parties");
  const joinCode = Array.from(
    { length: 6 },
    () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
        Math.floor(Math.random() * 62)
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
  const party = await getParty(partyId);
  await interaction.client.modules.updatePartyCards(interaction, party);
}

async function removeMemberFromParty(partyId, memberId, interaction) {
  return updateParty(partyId, { $pull: { members: { id: memberId } } }, interaction);
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
module.exports = {
  getParties,
  initDb,
  getCollection,
  createParty,
  getParty,
  updateParty,
  getPartyFromJoinCode,
  addPartyCardMessage,
  getCurrentParty,
  removeMemberFromParty,
  deleteParty,
};
