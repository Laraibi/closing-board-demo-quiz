import { Router } from "express";
import { Attempt, Feedback, Quiz, User } from "../models/index.js";
import { forbidden, invalid, notFound } from "../lib/errors.js";
import { canReachModule, requireRole } from "../lib/auth.js";
import { sendMail } from "../lib/mailer.js";

export function feedbackRoutes() {
  const router = Router();

  // Un formateur ne commente que les tentatives de ses modules.
  router.post("/", requireRole("trainer", "admin"), async (req, res, next) => {
    const attempt = await Attempt.findById(req.body?.attemptId).lean().catch(() => null);
    if (!attempt) return next(notFound("Tentative"));
    const quiz = await Quiz.findById(attempt.quiz).lean();
    if (!canReachModule(req.user, quiz.module)) return next(forbidden());
    const text = String(req.body?.text || "").trim();
    if (text.length < 5) return next(invalid([{ field: "text", message: "5 caractères minimum." }]));
    const entry = await Feedback.create({ attempt: attempt._id, user: attempt.user, author: req.user._id, text });
    const learner = await User.findById(attempt.user).lean();
    if (learner) await sendMail({ to: learner.email, template: "feedbackPosted", data: { name: learner.name } });
    res.status(201).json({ feedback: entry });
  });

  router.get("/me", async (req, res) => {
    res.json({ feedback: await Feedback.find({ user: req.user._id }).sort({ createdAt: -1 }).lean() });
  });

  return router;
}
