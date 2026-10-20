import { Router } from "express";
import { Attempt, Quiz } from "../models/index.js";
import { forbidden, invalid, notFound } from "../lib/errors.js";
import { canReachModule } from "../lib/auth.js";
import { sendMail } from "../lib/mailer.js";

export const maxAttempts = 3;

/** Score en pourcentage, arrondi. Une réponse absente compte comme fausse. */
export function score(questions, answers) {
  const good = questions.filter((question) => Number(answers?.[question._id]) === question.answer).length;
  return Math.round((good * 100) / questions.length);
}

export function attemptRoutes() {
  const router = Router();

  // La tentative est complète : chaque question doit avoir une réponse.
  router.post("/", async (req, res, next) => {
    const quiz = await Quiz.findById(req.body?.quizId).select("+questions.answer").lean().catch(() => null);
    if (!quiz) return next(notFound("Quiz"));
    if (!canReachModule(req.user, quiz.module)) return next(forbidden());
    const missing = quiz.questions.filter((question) => !Number.isInteger(req.body?.answers?.[question._id]));
    if (missing.length) return next(invalid(missing.map((question) => ({ field: `answers.${question._id}`, message: "Réponse manquante." }))));
    const previous = await Attempt.countDocuments({ quiz: quiz._id, user: req.user._id });
    if (previous >= maxAttempts) return next(invalid([{ field: "quizId", message: `${maxAttempts} tentatives maximum.` }]));
    const attempt = await Attempt.create({ quiz: quiz._id, user: req.user._id, answers: req.body.answers, score: score(quiz.questions, req.body.answers) });
    await sendMail({ to: req.user.email, template: "attemptScored", data: { name: req.user.name, score: attempt.score } });
    res.status(201).json({ attempt, remaining: maxAttempts - previous - 1 });
  });

  // Lecture privée : chacun ne lit que ses tentatives.
  router.get("/me", async (req, res) => {
    res.json({ attempts: await Attempt.find({ user: req.user._id }).sort({ createdAt: -1 }).lean() });
  });

  router.get("/progression", async (req, res) => {
    const quizzes = await Quiz.find({ module: { $in: req.user.modules || [] } }).select("_id").lean();
    const best = await Attempt.aggregate([
      { $match: { user: req.user._id, quiz: { $in: quizzes.map((quiz) => quiz._id) } } },
      { $group: { _id: "$quiz", best: { $max: "$score" } } }
    ]);
    const average = quizzes.length ? Math.round(best.reduce((sum, row) => sum + row.best, 0) / quizzes.length) : 0;
    res.json({ average, done: best.length, total: quizzes.length });
  });

  return router;
}
