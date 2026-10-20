// Toutes les erreurs de l'API ont la même forme JSON : { error: { code, message, details? } }.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what) => new ApiError(404, "NOT_FOUND", `${what} introuvable.`);
export const invalid = (details) => new ApiError(400, "VALIDATION_ERROR", "Données invalides.", details);
export const forbidden = () => new ApiError(403, "FORBIDDEN", "Accès refusé.");

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_JSON", message: "Corps JSON illisible." } });
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL", message: "Erreur serveur." } });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "Route introuvable." } });
}
