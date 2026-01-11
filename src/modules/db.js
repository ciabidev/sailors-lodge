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
async function createParty(name, description = "", visibility, memberLimit, owner) {
  const parties= getCollection("parties");
  // generate a random 6 digit number
  let joinCode = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  joinCode = joinCode.toString();
  const partyData = {
    name,
    description,
    visibility,
    memberLimit,
    owner,
    members: [owner],
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

async function getParty(_id) {
  const parties = getCollection("parties");
  return parties.findOne({ _id });
}

async function updateParty(_id, update, interaction) { // Also updates all partyCard discord messages
  const parties = getCollection("parties");

  if (!Object.keys(update).some((k) => k.startsWith("$"))) {
    throw new Error("updateParty requires MongoDB operators ($set, $push, etc)");
  }

  await parties.updateOne({ _id }, update);

  // Fetch the actual updated document
  const party = await parties.findOne({ _id });
  
  for (const card of party.cards) {
    try {
      const channel = await interaction.client.channels.fetch(card.channelId);
      const message = await channel.messages.fetch(card.messageId);
      if (!message || typeof message.edit !== "function") continue; // skip invalid

      await message.edit({ components: await interaction.client.modules.renderPartyCard(party, interaction) });
    } catch (err) {
      console.error(err);
    }
  }

  return party;
}


async function addPartyCardMessage(party, card) {
  const parties = getCollection("parties");
  return parties.updateOne({ _id: party }, { $push: { cards: card } });
}

async function getParties() {
  const parties = getCollection("parties");
  return parties.find({}).toArray();
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
};
