import assert from "node:assert/strict";
import mongoose from "mongoose";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.js";
import { seed } from "../scripts/seed.js";
import { outbox } from "../src/lib/mailer.js";
import { Quiz } from "../src/models/index.js";
import { signToken, verifyToken } from "../src/lib/auth.js";

// Base de test locale, vidée à chaque lancement.
const uri = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/lms-demo-test";
let server;
let base;
const tokens = {};

before(async () => {
  await mongoose.connect(uri);
  await seed();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const who of ["ada", "bob", "formatrice", "admin"]) {
    const res = await call("/api/auth/login", { method: "POST", body: { email: `${who}@example.com`, password: "demo1234" } });
    tokens[who] = res.data.token;
  }
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

function call(path, { as, method = "GET", body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(as ? { authorization: `Bearer ${tokens[as]}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => ({ status: res.status, data: await res.json() }));
}

describe("authentification", () => {
  test("mauvais mot de passe → 401, sans jeton → 401", async () => {
    assert.equal((await call("/api/auth/login", { method: "POST", body: { email: "ada@example.com", password: "non" } })).status, 401);
    assert.equal((await call("/api/quizzes")).status, 401);
  });

  test("un jeton modifié ou expiré est refusé", () => {
    const user = { _id: "x", role: "admin" };
    const token = signToken(user);
    assert.ok(verifyToken(token));
    assert.equal(verifyToken(`${token}x`), null);
    assert.equal(verifyToken(signToken(user, Date.now() - 9 * 3600 * 1000)), null);
  });
});

describe("quiz et accès par module", () => {
  test("un apprenant voit les quiz de son module, jamais les bonnes réponses", async () => {
    const { data } = await call("/api/quizzes", { as: "ada" });
    assert.equal(data.quizzes.length, 1);
    assert.equal("answer" in data.quizzes[0].questions[0], false);
  });

  test("un formateur crée un quiz dans son module seulement", async () => {
    const bad = await call("/api/quizzes", { as: "formatrice", method: "POST", body: { title: "x", questions: [] } });
    assert.equal(bad.data.error.code, "VALIDATION_ERROR");
    const other = await call("/api/quizzes", { as: "formatrice", method: "POST", body: { title: "Réseau", module: "devops", questions: [{ text: "?", choices: ["a", "b"], answer: 0 }] } });
    assert.equal(other.status, 403);
    const ok = await call("/api/quizzes", { as: "formatrice", method: "POST", body: { title: "REST", module: "backend", questions: [{ text: "?", choices: ["a", "b"], answer: 0 }] } });
    assert.equal(ok.status, 201);
    assert.equal((await call("/api/quizzes", { as: "ada", method: "POST", body: {} })).status, 403);
  });
});

describe("tentatives", () => {
  test("tentative complète, score, e-mail, trois au plus, lecture privée", async () => {
    const quiz = await Quiz.findOne({ title: "Bases HTTP" }).lean();
    const [first, second] = quiz.questions.map((question) => String(question._id));
    const incomplete = await call("/api/attempts", { as: "ada", method: "POST", body: { quizId: quiz._id, answers: { [first]: 1 } } });
    assert.equal(incomplete.status, 400);
    const scored = await call("/api/attempts", { as: "ada", method: "POST", body: { quizId: quiz._id, answers: { [first]: 1, [second]: 0 } } });
    assert.equal(scored.data.attempt.score, 50);
    assert.equal(outbox.at(-1).to, "ada@example.com");
    await call("/api/attempts", { as: "ada", method: "POST", body: { quizId: quiz._id, answers: { [first]: 1, [second]: 1 } } });
    await call("/api/attempts", { as: "ada", method: "POST", body: { quizId: quiz._id, answers: { [first]: 1, [second]: 1 } } });
    const fourth = await call("/api/attempts", { as: "ada", method: "POST", body: { quizId: quiz._id, answers: { [first]: 1, [second]: 1 } } });
    assert.equal(fourth.status, 400);
    assert.equal((await call("/api/attempts/me", { as: "ada" })).data.attempts.length, 3);
    assert.equal((await call("/api/attempts/me", { as: "bob" })).data.attempts.length, 0);
    assert.equal((await call("/api/attempts/progression", { as: "ada" })).data.done, 1);
  });
});

describe("feedback et administration", () => {
  test("feedback du formateur, lu par l'apprenant seulement", async () => {
    const mine = await call("/api/attempts/me", { as: "ada" });
    const posted = await call("/api/feedback", { as: "formatrice", method: "POST", body: { attemptId: mine.data.attempts[0]._id, text: "Revoir les verbes idempotents." } });
    assert.equal(posted.status, 201);
    assert.equal((await call("/api/feedback/me", { as: "ada" })).data.feedback.length, 1);
    assert.equal((await call("/api/feedback/me", { as: "bob" })).data.feedback.length, 0);
  });

  test("réglages, cron validé, job manuel, statistiques, erreurs JSON", async () => {
    assert.equal((await call("/api/admin/settings", { as: "ada" })).status, 403);
    assert.equal((await call("/api/admin/settings", { as: "admin", method: "PATCH", body: { digestCron: "tous les jours" } })).status, 400);
    const ok = await call("/api/admin/settings", { as: "admin", method: "PATCH", body: { digestCron: "30 17 * * *" } });
    assert.equal(ok.data.settings.digestCron, "30 17 * * *");
    assert.ok((await call("/api/admin/jobs/digest", { as: "admin", method: "POST" })).data.attempts >= 3);
    assert.equal((await call("/api/admin/stats", { as: "admin" })).data.byModule.backend, 2);
    assert.equal((await call("/api/nope", { as: "ada" })).data.error.code, "ROUTE_NOT_FOUND");
  });
});

describe("préférences du formateur", () => {
  test("heure et modules validés, apprenant refusé", async () => {
    assert.equal((await call("/api/me/preferences", { as: "ada" })).status, 403);
    assert.equal((await call("/api/me/preferences", { as: "formatrice", method: "PATCH", body: { hour: 30 } })).status, 400);
    assert.equal((await call("/api/me/preferences", { as: "formatrice", method: "PATCH", body: { modules: ["devops"] } })).status, 400);
    const ok = await call("/api/me/preferences", { as: "formatrice", method: "PATCH", body: { hour: 7, modules: ["backend"] } });
    assert.equal(ok.data.digest.hour, 7);
    assert.deepEqual(ok.data.digest.modules, ["backend"]);
  });
});
