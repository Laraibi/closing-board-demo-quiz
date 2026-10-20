import { Router } from "express";
import { Attempt, Quiz, settings } from "../models/index.js";
import { invalid } from "../lib/errors.js";
import { requireRole } from "../lib/auth.js";
import { runDigest } from "../jobs/digest.js";

const cronPattern = /^(\S+\s+){4}\S+$/;

export function adminRoutes() {
  const router = Router();
  router.use(requireRole("admin"));

  router.get("/settings", async (_req, res) => res.json({ settings: await settings() }));

  router.patch("/settings", async (req, res, next) => {
    const current = await settings();
    if ("emailsEnabled" in (req.body || {})) current.emailsEnabled = Boolean(req.body.emailsEnabled);
    if ("digestCron" in (req.body || {})) {
      if (!cronPattern.test(String(req.body.digestCron))) return next(invalid([{ field: "digestCron", message: "Expression cron à 5 champs." }]));
      current.digestCron = String(req.body.digestCron);
    }
    await current.save();
    res.json({ settings: current });
  });

  router.post("/jobs/digest", async (_req, res) => res.json(await runDigest()));

  router.get("/stats", async (_req, res) => {
    const [quizzes, attempts, average, byModule] = await Promise.all([
      Quiz.countDocuments(),
      Attempt.countDocuments(),
      Attempt.aggregate([{ $group: { _id: null, value: { $avg: "$score" } } }]),
      Quiz.aggregate([{ $group: { _id: "$module", count: { $sum: 1 } } }])
    ]);
    res.json({ quizzes, attempts, averageScore: Math.round(average[0]?.value || 0), byModule: Object.fromEntries(byModule.map((row) => [row._id, row.count])) });
  });

  return router;
}
