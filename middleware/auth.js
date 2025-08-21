import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token provided" });

  const token = auth.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || "devsecret", (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = decoded; // { id, role, email }
    next();
  });
};

export const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "No user" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admins only" });
  next();
};
