import { Router } from "express";
import { Quiz } from "../models/index.js";
import { forbidden, invalid, notFound } from "../lib/errors.js";
import { canReachModule, requireRole } from "../lib/auth.js";

export function quizProblems(body) {
  const problems = [];
  if (!body?.title || String(body.title).trim().length < 3) problems.push({ field: "title", message: "3 caractères minimum." });
  if (!body?.module) problems.push({ field: "module", message: "Module requis." });
  if (!Array.isArray(body?.questions) || !body.questions.length) problems.push({ field: "questions", message: "Au moins une question." });
  for (const [index, question] of (body?.questions || []).entries()) {
    if (!Array.isArray(question.choices) || question.choices.length < 2) problems.push({ field: `questions.${index}.choices`, message: "Deux choix minimum." });
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= (question.choices || []).length) {
      problems.push({ field: `questions.${index}.answer`, message: "Index de bonne réponse invalide." });
    }
  }
  return problems;
}

export function quizRoutes() {
  const router = Router();

  // Les bonnes réponses ne quittent jamais la base (select: false) sauf pour l'auteur.
  router.get("/", async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { module: { $in: req.user.modules || [] } };
    res.json({ quizzes: await Quiz.find(filter).lean() });
  });

  router.get("/:id", async (req, res, next) => {
    const quiz = await Quiz.findById(req.params.id).lean().catch(() => null);
    if (!quiz) return next(notFound("Quiz"));
    if (!canReachModule(req.user, quiz.module)) return next(forbidden());
    res.json({ quiz });
  });

  router.post("/", requireRole("trainer", "admin"), async (req, res, next) => {
    const problems = quizProblems(req.body);
    if (problems.length) return next(invalid(problems));
    if (!canReachModule(req.user, req.body.module)) return next(forbidden());
    const quiz = await Quiz.create({ title: req.body.title, module: req.body.module, author: req.user._id, questions: req.body.questions });
    res.status(201).json({ quiz: await Quiz.findById(quiz._id).lean() });
  });

  return router;
}
