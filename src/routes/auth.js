import { Router } from "express";
import { User } from "../models/index.js";
import { ApiError, invalid } from "../lib/errors.js";
import { checkPassword, signToken } from "../lib/auth.js";

export function authRoutes() {
  const router = Router();
  router.post("/login", async (req, res, next) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return next(invalid([{ field: "email", message: "E-mail et mot de passe requis." }]));
    const user = await User.findOne({ email });
    if (!user || !checkPassword(password, user.passwordHash)) return next(new ApiError(401, "BAD_CREDENTIALS", "E-mail ou mot de passe incorrect."));
    res.json({ token: signToken(user), user: { id: user._id, name: user.name, role: user.role } });
  });
  return router;
}
