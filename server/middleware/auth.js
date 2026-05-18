import jwt from "jsonwebtoken";
import { sendError } from "../utils/response.js";

export const authGuard = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return sendError(res, "Missing or invalid token", 401);
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return sendError(res, "Token verification failed", 401);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return sendError(res, "Not authorized for this action", 403);
  }
  return next();
};
