import { Attempt, settings } from "../models/index.js";

// Résumé quotidien pour le formateur : tentatives des dernières 24 h.
export async function runDigest(now = new Date()) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = await Attempt.find({ createdAt: { $gte: since } }).select("score").lean();
  return { at: now.toISOString(), attempts: recent.length, average: recent.length ? Math.round(recent.reduce((sum, a) => sum + a.score, 0) / recent.length) : 0 };
}

// Vérifie chaque minute l'heure du cron "m h * * *" enregistrée par l'admin.
export function scheduleDigest(log = console.log) {
  return setInterval(async () => {
    const [minute, hour] = (await settings()).digestCron.split(/\s+/);
    const now = new Date();
    if (String(now.getMinutes()) === minute && String(now.getHours()) === hour) log("[digest]", await runDigest(now));
  }, 60 * 1000);
}
