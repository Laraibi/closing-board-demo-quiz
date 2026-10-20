import crypto from "node:crypto";
import { User } from "../models/index.js";
import { ApiError, forbidden } from "./errors.js";

const secret = () => process.env.JWT_SECRET || "dev-only-secret-change-me";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString("hex")}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

/** JWT HS256 signé, valable 8 heures. */
export function signToken(user, now = Date.now()) {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: String(user._id), role: user.role, exp: Math.floor(now / 1000) + 8 * 3600 });
  const signature = crypto.createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token, now = Date.now()) {
  const [header, payload, signature] = String(token || "").split(".");
  if (!header || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return data.exp * 1000 > now ? data : null;
}

/** Identité vérifiée : le jeton Bearer, puis le compte en base. */
export async function requireAuth(req, _res, next) {
  const token = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const data = verifyToken(token);
  if (!data) return next(new ApiError(401, "UNAUTHENTICATED", "Connexion requise."));
  const user = await User.findById(data.sub).lean();
  if (!user) return next(new ApiError(401, "UNAUTHENTICATED", "Compte introuvable."));
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => (roles.includes(req.user?.role) ? next() : next(forbidden()));

/** Un apprenant suit le module, un formateur l'enseigne, l'admin voit tout. */
export function canReachModule(user, module) {
  return user.role === "admin" || (user.modules || []).includes(module);
}
