const defaultOrigins = [
  "http://localhost:5173",
  "https://lechat-public.vercel.app",
];

const normalizeOrigin = (value) => {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.warn(`Ignoring unsupported CORS origin: ${candidate}`);
      return null;
    }
    return url.origin;
  } catch {
    console.warn(`Ignoring invalid CORS origin: ${candidate}`);
    return null;
  }
};

const configuredOrigins = [
  ...defaultOrigins,
  process.env.BASE_URL || "",
  // Set CORS_ORIGINS to comma-separated frontend origins on Render.
  ...(process.env.CORS_ORIGINS || "").split(","),
];

export const allowedOrigins = [
  ...new Set(configuredOrigins.map(normalizeOrigin).filter(Boolean)),
];

export const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

export const socketCorsOptions = {
  origin: allowedOrigins,
  credentials: true,
};
