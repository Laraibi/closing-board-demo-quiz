import { Router } from "express";
import { User } from "../models/index.js";
import { invalid } from "../lib/errors.js";
import { requireRole } from "../lib/auth.js";

// Chaque formateur règle son résumé quotidien : activé, heure, modules.
export function preferenceRoutes() {
  const router = Router();
  router.use(requireRole("trainer", "admin"));

  router.get("/", async (req, res) => {
    const user = await User.findById(req.user._id).select("digest").lean();
    res.json({ digest: user.digest });
  });

  router.patch("/", async (req, res, next) => {
    const problems = [];
    const patch = {};
    if ("enabled" in (req.body || {})) patch["digest.enabled"] = Boolean(req.body.enabled);
    if ("hour" in (req.body || {})) {
      if (!Number.isInteger(req.body.hour) || req.body.hour < 0 || req.body.hour > 23) problems.push({ field: "hour", message: "Heure entre 0 et 23." });
      else patch["digest.hour"] = req.body.hour;
    }
    if ("modules" in (req.body || {})) {
      const wanted = Array.isArray(req.body.modules) ? req.body.modules.map(String) : [];
      const outside = wanted.filter((module) => !(req.user.modules || []).includes(module));
      if (outside.length) problems.push({ field: "modules", message: `Modules non enseignés : ${outside.join(", ")}.` });
      else patch["digest.modules"] = wanted;
    }
    if (problems.length) return next(invalid(problems));
    const user = await User.findByIdAndUpdate(req.user._id, { $set: patch }, { new: true }).select("digest").lean();
    res.json({ digest: user.digest });
  });

  return router;
}
