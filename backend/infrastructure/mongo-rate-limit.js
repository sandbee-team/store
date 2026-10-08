"use strict";
const { AppError } = require("../shared/errors");
// Fixed windows are identified in the primary key. TTL cleanup timing is never
// used as authorization, so replica/process restarts cannot reset a live budget.
class MongoRateLimit {
  constructor(db) {
    this.counters = db.collection("rate_limits");
  }
  async consume(identity, bucket, limit, windowMs = 60000) {
    const now = Date.now(),
      window = Math.floor(now / windowMs),
      end = (window + 1) * windowMs;
    const query = { _id: `${bucket}:${identity}:${window}` };
    const update = {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(end + windowMs) },
    };
    let record;
    try {
      record = await this.counters.findOneAndUpdate(query, update, {
        upsert: true,
        returnDocument: "after",
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await this.counters.findOneAndUpdate(query, update, {
        returnDocument: "after",
      });
    }
    if (!record || record.count > limit) {
      const error = new AppError(
        429,
        "RATE_LIMITED",
        "Your account reached this service limit. Wait before retrying.",
      );
      error.retryAfter = Math.max(1, Math.ceil((end - now) / 1000));
      throw error;
    }
    return { remaining: limit - record.count, resetAt: new Date(end) };
  }
}
module.exports = { MongoRateLimit };
