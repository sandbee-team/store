"use strict";
const { MongoClient } = require("mongodb");
async function connectDatabase(config) {
  const client = new MongoClient(config.mongoUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000,
  });
  try {
    await client.connect();
    const db = client.db(config.dbName);
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db
        .collection("users")
        .createIndex({ "sessions.hash": 1 }, { unique: true, sparse: true }),
      db.collection("workspaces").createIndex({ ownerId: 1 }, { unique: true }),
      db
        .collection("workspaces")
        .createIndex({ "members.userId": 1, "members.active": 1 }),
      db.collection("workspaces").createIndex({ "invitations.email": 1 }),
      db
        .collection("workspaces")
        .createIndex({ "tokens.hash": 1 }, { unique: true, sparse: true }),
      db
        .collection("users")
        .createIndex(
          { "legacyLinks.gst.sourceKey": 1 },
          { unique: true, sparse: true },
        ),
      db
        .collection("users")
        .createIndex(
          { "legacyLinks.ocr.sourceKey": 1 },
          { unique: true, sparse: true },
        ),
      db
        .collection("rate_limits")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("request_grants")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("usage_events")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("usage_events")
        .createIndex({ accountId: 1, state: 1, createdAt: -1 }),
      db
        .collection("usage_events")
        .createIndex({ accountId: 1, createdAt: -1 }),
    ]);
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
module.exports = { connectDatabase };
