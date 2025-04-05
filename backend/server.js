const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure the uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Basic in-memory storage
const videos = [];
const users = [
  { id: "1", username: "creator1", password: "password", role: "creator" },
  { id: "2", username: "consumer1", password: "password", role: "consumer" },
];
const comments = [];

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/uploads", express.static(UPLOADS_DIR));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only video and image files
    if (
      file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("image/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only video and image files are allowed!"), false);
    }
  },
});

// Basic authentication middleware
const authenticate = (req, res, next) => {
  const { username, password } = req.headers;

  if (!username || !password) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.user = user;
  next();
};

// Role-based access control middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};

// AUTH ENDPOINTS
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.status(200).json({
    id: user.id,
    username: user.username,
    role: user.role,
  });
});

// CREATOR ENDPOINTS
app.post(
  "/api/upload",
  authenticate,
  authorize(["creator"]),
  upload.single("mediaFile"),
  (req, res) => {
    try {
      const { title, caption, location, peoplePresent } = req.body;
      const filePath = req.file.path;
      const fileType = req.file.mimetype.startsWith("video/")
        ? "video"
        : "image";

      const newMedia = {
        id: Date.now().toString(),
        title,
        caption,
        location,
        peoplePresent: peoplePresent.split(",").map((p) => p.trim()),
        filePath,
        fileType,
        creatorId: req.user.id,
        creatorName: req.user.username,
        createdAt: new Date().toISOString(),
        ratings: [],
        averageRating: 0,
      };

      videos.push(newMedia);

      res.status(201).send({
        message: `${
          fileType.charAt(0).toUpperCase() + fileType.slice(1)
        } uploaded successfully!`,
        media: newMedia,
      });
    } catch (error) {
      console.error("Error uploading media:", error);
      res.status(500).send({ message: "Failed to upload media." });
    }
  }
);

app.delete(
  "/api/videos/:id",
  authenticate,
  authorize(["creator"]),
  (req, res) => {
    const { id } = req.params;
    const videoIndex = videos.findIndex(
      (v) => v.id === id && v.creatorId === req.user.id
    );

    if (videoIndex !== -1) {
      const [deletedVideo] = videos.splice(videoIndex, 1);

      // Delete the media file from the uploads directory using absolute path
      const absoluteFilePath = path.resolve(deletedVideo.filePath);
      fs.unlink(absoluteFilePath, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
        }
      });

      // Delete associated comments
      const commentsToRemove = comments.filter((c) => c.videoId === id);
      commentsToRemove.forEach((comment) => {
        const commentIndex = comments.indexOf(comment);
        if (commentIndex !== -1) {
          comments.splice(commentIndex, 1);
        }
      });

      res.status(200).send({ message: "Media deleted successfully!" });
    } else {
      res.status(404).send({
        message: "Media not found or you don't have permission to delete it!",
      });
    }
  }
);

app.get(
  "/api/creator/dashboard",
  authenticate,
  authorize(["creator"]),
  (req, res) => {
    const creatorVideos = videos.filter((v) => v.creatorId === req.user.id);

    const dashboard = {
      totalUploads: creatorVideos.length,
      totalRatings: creatorVideos.reduce((acc, v) => acc + v.ratings.length, 0),
      averageRating:
        creatorVideos.length > 0
          ? creatorVideos.reduce((acc, v) => acc + v.averageRating, 0) /
            creatorVideos.length
          : 0,
      videos: creatorVideos,
    };

    res.status(200).json(dashboard);
  }
);

// CONSUMER ENDPOINTS
app.get("/api/videos", (req, res) => {
  const { search, sortBy } = req.query;

  let filteredVideos = [...videos];

  // Filter by search term
  if (search) {
    const searchTerm = search.toLowerCase();
    filteredVideos = filteredVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(searchTerm) ||
        v.caption.toLowerCase().includes(searchTerm) ||
        v.location.toLowerCase().includes(searchTerm) ||
        v.peoplePresent.some((p) => p.toLowerCase().includes(searchTerm))
    );
  }

  // Sort videos
  if (sortBy === "newest") {
    filteredVideos.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  } else if (sortBy === "highest-rated") {
    filteredVideos.sort((a, b) => b.averageRating - a.averageRating);
  }

  // Return only necessary data for listing
  const responseVideos = filteredVideos.map((v) => ({
    id: v.id,
    title: v.title,
    caption: v.caption,
    fileType: v.fileType,
    creatorName: v.creatorName,
    createdAt: v.createdAt,
    averageRating: v.averageRating,
    ratingCount: v.ratings.length,
  }));

  res.status(200).json(responseVideos);
});

app.get("/api/videos/:id", (req, res) => {
  const { id } = req.params;
  const video = videos.find((v) => v.id === id);

  if (video) {
    const videoComments = comments.filter((c) => c.videoId === id);

    const responseVideo = {
      ...video,
      comments: videoComments,
    };

    res.status(200).json(responseVideo);
  } else {
    res.status(404).json({ message: "Media not found!" });
  }
});

app.post("/api/videos/:id/rate", authenticate, (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res
      .status(400)
      .json({ message: "Invalid rating. Must be between 1 and 5." });
  }

  const video = videos.find((v) => v.id === id);

  if (video) {
    // Check if user already rated this video
    const existingRatingIndex = video.ratings.findIndex(
      (r) => r.userId === req.user.id
    );

    if (existingRatingIndex !== -1) {
      // Update existing rating
      video.ratings[existingRatingIndex].value = rating;
    } else {
      // Add new rating
      video.ratings.push({
        userId: req.user.id,
        username: req.user.username,
        value: rating,
      });
    }

    // Recalculate average rating
    video.averageRating =
      video.ratings.reduce((acc, r) => acc + r.value, 0) / video.ratings.length;

    res.status(200).json({
      message: "Rating submitted successfully!",
      newAverageRating: video.averageRating,
    });
  } else {
    res.status(404).json({ message: "Media not found!" });
  }
});

app.post("/api/videos/:id/comment", authenticate, (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({ message: "Comment text is required." });
  }

  const video = videos.find((v) => v.id === id);

  if (video) {
    const newComment = {
      id: Date.now().toString(),
      videoId: id,
      userId: req.user.id,
      username: req.user.username,
      text,
      createdAt: new Date().toISOString(),
    };

    comments.push(newComment);

    res.status(201).json({
      message: "Comment added successfully!",
      comment: newComment,
    });
  } else {
    res.status(404).json({ message: "Media not found!" });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("Welcome to the Video Sharing API!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
