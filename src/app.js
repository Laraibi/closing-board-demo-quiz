import express from "express";
import { requireAuth } from "./lib/auth.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { quizRoutes } from "./routes/quizzes.js";
import { attemptRoutes } from "./routes/attempts.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { adminRoutes } from "./routes/admin.js";
import { preferenceRoutes } from "./routes/preferences.js";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes());
  app.use("/api", requireAuth);
  app.use("/api/quizzes", quizRoutes());
  app.use("/api/attempts", attemptRoutes());
  app.use("/api/feedback", feedbackRoutes());
  app.use("/api/admin", adminRoutes());
  app.use("/api/me/preferences", preferenceRoutes());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
