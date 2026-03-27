require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { testConnection } = require("./config/database");

//routes
const authRoutes = require("./routes/auth");
const programsRoutes = require("./routes/programs");
const donationsRoutes = require("./routes/donations");
const volunteersRoutes = require("./routes/volunteers");
const blogRoutes = require("./routes/blog");
const contactRoutes = require("./routes/contact");
const statsRoutes = require("./routes/stats");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      process.env.PUBLIC_FRONTEND_URL || "http://localhost:3000",
      process.env.ADMIN_FRONTEND_URL || "http://localhost:3001",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/programs", programsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/volunteers", volunteersRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/stats", statsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Lionista Foundation API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      programs: "/api/programs",
      donations: "/api/donations",
      volunteers: "/api/volunteers",
      blog: "/api/blog",
      contact: "/api/contact",
      stats: "/api/stats",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const startServer = async () => {
  console.log("");
  // console.log('=========================================');
  console.log("   LIONISTA FOUNDATION BACKEND");
  // console.log('=========================================');
  console.log("");

  // Test database connection
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.log("");
    console.log(" Warning: Database connection failed.");
    console.log("   Please check your DATABASE_URL in .env");
    console.log("");
  }

  app.listen(PORT, () => {
    console.log("");
    console.log(`Server running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
    // console.log('');
    // console.log('Available endpoints:');
    // console.log('  - GET  /api/health');
    // console.log('  - POST /api/auth/login');
    // console.log('  - GET  /api/programs');
    // console.log('  - GET  /api/blog');
    // console.log('  - POST /api/donations');
    // console.log('  - POST /api/volunteers');
    // console.log('  - POST /api/contact');
    // console.log('  - GET  /api/stats');
    // console.log('');
    // console.log('=========================================');
  });
};

startServer();
