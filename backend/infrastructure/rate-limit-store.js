"use strict";
const { LRUCache } = require("lru-cache");
const { AppError } = require("../shared/errors");
// Bounded fixed-window counters. Never evict an active counter to admit a new key.
class BoundedRateStore {
  constructor(max = 20000) {
    this.max = max;
    this.localKeys = true;
  }
  init({ windowMs }) {
    this.windowMs = windowMs;
    this.cache = new LRUCache({
      max: this.max,
      ttl: windowMs,
      ttlAutopurge: true,
      ttlResolution: 0,
    });
  }
  async increment(key) {
    let record = this.cache.get(key);
    if (!record) {
      if (this.cache.size >= this.max) {
        this.cache.purgeStale();
        if (this.cache.size >= this.max)
          throw new AppError(
            503,
            "SERVICE_BUSY",
            "The service is busy. Please retry shortly.",
          );
      }
      record = {
        totalHits: 0,
        resetTime: new Date(Date.now() + this.windowMs),
      };
      this.cache.set(key, record);
    }
    record.totalHits++;
    return { ...record };
  }
  async decrement(key) {
    const record = this.cache.get(key);
    if (record) record.totalHits = Math.max(0, record.totalHits - 1);
  }
  async resetKey(key) {
    this.cache.delete(key);
  }
  shutdown() {
    this.cache?.clear();
  }
}
module.exports = { BoundedRateStore };
