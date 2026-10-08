"use strict";
async function usageReport(db, workspaceId, days, now = new Date(), service) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = new Date(+today - (days - 1) * 86400000);
  const rows = await db
    .collection("usage_events")
    .aggregate([
      {
        $match: {
          accountId: workspaceId,
          ...(service ? { service } : {}),
          createdAt: { $gte: from, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "UTC",
              },
            },
            service: "$service",
            state: "$state",
            source: "$source",
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const empty = () => ({
    authorized: 0,
    success: 0,
    failed: 0,
    pending: 0,
    gst: 0,
    demo: 0,
    cached: 0,
  });
  const series = Array.from({ length: days }, (_, i) => ({
    date: new Date(+from + i * 86400000).toISOString().slice(0, 10),
    ...empty(),
  }));
  const byDay = new Map(series.map((row) => [row.date, row]));
  const totals = empty();
  for (const row of rows) {
    const day = byDay.get(row._id.day);
    if (!day) continue;
    for (const target of [day, totals]) {
      target.authorized += row.count;
      target[row._id.state === "authorized" ? "pending" : row._id.state] +=
        row.count;
      if (row._id.state === "success") {
        target[row._id.service === "gst" ? "gst" : "demo"] += row.count;
        if (row._id.source === "database") target.cached += row.count;
      }
    }
  }
  return {
    days,
    timezone: "UTC",
    from: from.toISOString(),
    to: now.toISOString(),
    totals,
    series,
  };
}
module.exports = { usageReport };
