"use strict";
const { z } = require("zod");
const { usageReport } = require("./service");
function mountReports({ app, db, platform }) {
  app.get("/api/reports/usage", ...platform.read, async (req, res) => {
    const { days, service } = z
      .object({
        days: z.enum(["7", "30", "90"]).default("30"),
        service: z.enum(["gst", "ocr-demo"]).optional(),
      })
      .strict()
      .parse(req.query);
    res.json(
      await usageReport(
        db,
        req.workspace._id,
        Number(days),
        new Date(),
        service,
      ),
    );
  });
}
module.exports = { mountReports };
