const { MongoClient, ServerApiVersion } = require("mongodb");
const { mongoUri, devMode } = require("../../config.json"); // adjust path

const client = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

// ---------- INIT DB ----------
async function initDb() {
  await client.connect();
  const mongoDbName = devMode ? "development" : "production";
  db = client.db(mongoDbName);
}

// ---------- COLLECTION HELPER ----------
function getCollection(collectionName) {
  return db.collection(collectionName);
}

// ---------- GET SETTINGS ----------
async function getSettings(guildId) {
  const serverSettings = getCollection("serverSettings");
  return serverSettings.findOne({ guildId });
}

// ---------- SET SETTINGS ----------
async function setSettings(guildId, settings) {
  const serverSettings = getCollection("serverSettings");

  // Include guildId to upsert
  const fullDocument = { guildId, ...settings };

  // Upsert: replace the document if exists, insert if not
  await serverSettings.replaceOne({ guildId }, fullDocument, { upsert: true });
}

// ---------- EXAMPLE USAGE ----------
(async () => {
  await initDb(); // must call first

  // Set some settings
  await setSettings("1000123456789012345", {
    receivePingsFromOtherServers: true,
    sendPingsToOtherServers: true,
    hostRoles: ["Host", "Hosts"],
    useCrossServerThreads: true,
    localRegionConfig: {
      "north-america": { channelId: "1000123456789012345", pingRoleId: "1000123456789012345" },
      "south-america": { channelId: "1000123456789012345", pingRoleId: "1000123456789012345" },
      europe: { channelId: "1000123456789012345", pingRoleId: "1000123456789012345" },
      asia: { channelId: "1000123456789012345", pingRoleId: "1000123456789012345" },
      africa: { channelId: "1000123456789012345", pingRoleId: "1000123456789012345" },
      oceania: { channelId: "1000123456789012345", pingRoleId: "1000123456789012345" },
    },
  });

  // Get settings
  const settings = await getSettings("1000123456789012345");
  console.log(settings);
})();

module.exports = {
  initDb,
  getCollection,
  getSettings,
  setSettings,
};
