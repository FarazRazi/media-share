// Global variables
let currentUser = null;
let currentMediaId = null;

// Configure API URL and media URL based on environment
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000/api"
    : "https://media-share-iule.onrender.com/api";

const getMediaUrl = (media) => {
  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://media-share-iule.onrender.com";
  if (media.fileUrl) return media.fileUrl;
  const filename = media.filePath.split("/").pop().split("\\").pop();
  return `${baseUrl}/uploads/${filename}`;
};

// DOM Elements
const loginView = document.getElementById("loginView");
const creatorView = document.getElementById("creatorView");
const consumerView = document.getElementById("consumerView");
const userDisplay = document.getElementById("userDisplay");
const loginLink = document.getElementById("loginLink");
const logoutLink = document.getElementById("logoutLink");
const homeLink = document.getElementById("homeLink");
const creatorLink = document.getElementById("creatorLink");

// Check for stored user session
function checkUserSession() {
  const storedUser = localStorage.getItem("currentUser");
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    updateUIForUser();
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  checkUserSession();
  loadVideos();

  // Login form submission
  document.getElementById("loginForm").addEventListener("submit", handleLogin);

  // Upload form submission
  document
    .getElementById("uploadForm")
    .addEventListener("submit", handleUpload);

  // Search functionality
  document.getElementById("searchButton").addEventListener("click", () => {
    loadVideos(
      document.getElementById("searchInput").value,
      document.getElementById("sortSelect").value
    );
  });

  // Comment form submission
  document
    .getElementById("commentForm")
    .addEventListener("submit", handleComment);

  // Navigation links
  homeLink.addEventListener("click", showConsumerView);
  creatorLink.addEventListener("click", showCreatorView);
  loginLink.addEventListener("click", showLoginView);
  logoutLink.addEventListener("click", handleLogout);

  // Modal close button
  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("mediaModal").style.display = "none";
  });
});

// View handling functions
function showLoginView(e) {
  if (e) e.preventDefault();
  loginView.style.display = "block";
  creatorView.style.display = "none";
  consumerView.style.display = "none";

  updateActiveNavLink(loginLink);
}

function showCreatorView(e) {
  if (e) e.preventDefault();

  if (!currentUser || currentUser.role !== "creator") {
    alert("You need to login as a creator to access this page.");
    showLoginView();
    return;
  }

  loginView.style.display = "none";
  creatorView.style.display = "block";
  consumerView.style.display = "none";

  loadCreatorDashboard();
  updateActiveNavLink(creatorLink);
}

function showConsumerView(e) {
  if (e) e.preventDefault();
  loginView.style.display = "none";
  creatorView.style.display = "none";
  consumerView.style.display = "block";

  loadVideos();
  updateActiveNavLink(homeLink);
}

function updateActiveNavLink(activeLink) {
  const navLinks = document.querySelectorAll("header nav a");
  navLinks.forEach((link) => link.classList.remove("active"));
  activeLink.classList.add("active");
}

// Authentication functions
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data;
      currentUser.password = password; // Store password for authentication
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      updateUIForUser();

      if (currentUser.role === "creator") {
        showCreatorView();
      } else {
        showConsumerView();
      }
    } else {
      alert(data.message || "Login failed");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("An error occurred during login");
  }
}

function handleLogout(e) {
  if (e) e.preventDefault();

  currentUser = null;
  localStorage.removeItem("currentUser");
  updateUIForUser();
  showConsumerView();
}

function updateUIForUser() {
  if (currentUser) {
    userDisplay.textContent = `Hello, ${currentUser.username}`;
    loginLink.style.display = "none";
    logoutLink.style.display = "inline";

    // Show/hide creator link based on role
    creatorLink.style.display =
      currentUser.role === "creator" ? "inline" : "none";
  } else {
    userDisplay.textContent = "";
    loginLink.style.display = "inline";
    logoutLink.style.display = "none";
    creatorLink.style.display = "none";
  }
}

// Creator functions
async function handleUpload(event) {
  event.preventDefault();

  if (!currentUser || currentUser.role !== "creator") {
    alert("You must be logged in as a creator to upload media");
    return;
  }

  const title = document.getElementById("title").value;
  const caption = document.getElementById("caption").value;
  const location = document.getElementById("location").value;
  const peoplePresent = document.getElementById("peoplePresent").value;
  const mediaFile = document.getElementById("mediaFile").files[0];

  if (!mediaFile) {
    alert("Please select a file to upload");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("caption", caption);
  formData.append("location", location);
  formData.append("peoplePresent", peoplePresent);
  formData.append("mediaFile", mediaFile);

  try {
    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      headers: {
        username: currentUser.username,
        password: currentUser.password,
      },
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message);
      document.getElementById("uploadForm").reset();
      //   loadCreatorDashboard();
    } else {
      alert(result.message || "Upload failed");
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert("An error occurred during upload");
  }
}

async function loadCreatorDashboard() {
  if (!currentUser || currentUser.role !== "creator") return;

  try {
    const response = await fetch(`${API_URL}/creator/dashboard`, {
      headers: {
        username: currentUser.username,
        password: currentUser.password,
      },
    });

    const dashboard = await response.json();

    // Update dashboard stats
    document.getElementById("totalUploads").textContent =
      dashboard.totalUploads;
    document.getElementById("averageRating").textContent =
      dashboard.averageRating.toFixed(1);
    document.getElementById("totalRatings").textContent =
      dashboard.totalRatings;

    // Populate media list
    const mediaListElement = document.getElementById("creatorMediaList");
    mediaListElement.innerHTML = "";

    if (dashboard.videos.length === 0) {
      mediaListElement.innerHTML = "<p>No content uploaded yet</p>";
      return;
    }

    dashboard.videos.forEach((media) => {
      const mediaItem = document.createElement("div");
      mediaItem.className = "media-item";

      mediaItem.innerHTML = `
                <h4>${media.title}</h4>
                <p>${media.caption.substring(0, 100)}${
        media.caption.length > 100 ? "..." : ""
      }</p>
                <p>Type: ${media.fileType}</p>
                <p>Rating: ${media.averageRating.toFixed(1)} (${
        media.ratings.length
      } ratings)</p>
                <button onclick="viewMedia('${media.id}')">View</button>
                <button onclick="deleteMedia('${media.id}')">Delete</button>
            `;

      mediaListElement.appendChild(mediaItem);
    });
  } catch (error) {
    console.error("Error loading creator dashboard:", error);
    alert("Error loading dashboard data");
  }
}

async function deleteMedia(mediaId) {
  if (!confirm("Are you sure you want to delete this media?")) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/videos/${mediaId}`, {
      method: "DELETE",
      headers: {
        username: currentUser.username,
        password: currentUser.password,
      },
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message);
      //   loadCreatorDashboard();

      // Close modal if open
      if (currentMediaId === mediaId) {
        document.getElementById("mediaModal").style.display = "none";
        currentMediaId = null;
      }
    } else {
      alert(result.message || "Failed to delete media");
    }
  } catch (error) {
    console.error("Error deleting media:", error);
    alert("An error occurred while deleting the media");
  }
}

// Consumer functions
async function loadVideos(search = "", sortBy = "newest") {
  try {
    const queryParams = new URLSearchParams();
    if (search) queryParams.append("search", search);
    if (sortBy) queryParams.append("sortBy", sortBy);

    const response = await fetch(`${API_URL}/videos?${queryParams}`);
    const videos = await response.json();

    const videoList = document.getElementById("videoList");
    videoList.innerHTML = "";

    if (videos.length === 0) {
      videoList.innerHTML = "<p>No videos found</p>";
      return;
    }

    videos.forEach((video) => {
      const videoItem = document.createElement("div");
      videoItem.className = "media-item";

      const ratingStars = getStarRating(video.averageRating);

      videoItem.innerHTML = `
                <h3>${video.title}</h3>
                <p>${video.caption.substring(0, 100)}${
        video.caption.length > 100 ? "..." : ""
      }</p>
                <p>By ${video.creatorName} • ${formatDate(video.createdAt)}</p>
                <p>${ratingStars} (${video.ratingCount} ratings)</p>
                <button onclick="viewMedia('${video.id}')">View</button>
            `;

      videoList.appendChild(videoItem);
    });
  } catch (error) {
    console.error("Error loading videos:", error);
    alert("Failed to load videos");
  }
}

function getStarRating(averageRating) {
  const fullStar = "★";
  const emptyStar = "☆";
  const maxStars = 5;

  const fullStarsCount = Math.floor(averageRating);
  const emptyStarsCount = maxStars - fullStarsCount;

  return fullStar.repeat(fullStarsCount) + emptyStar.repeat(emptyStarsCount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function viewMedia(mediaId) {
  try {
    const response = await fetch(`${API_URL}/videos/${mediaId}`);
    const media = await response.json();

    if (!response.ok) {
      alert(media.message || "Failed to load media");
      return;
    }

    currentMediaId = mediaId;

    // Set modal content
    document.getElementById("modalTitle").textContent = media.title;
    document.getElementById(
      "modalCreator"
    ).textContent = `By: ${media.creatorName}`;
    document.getElementById("modalDate").textContent = `Posted: ${formatDate(
      media.createdAt
    )}`;
    document.getElementById("modalCaption").textContent = media.caption;
    document.getElementById(
      "modalLocation"
    ).textContent = `Location: ${media.location}`;
    document.getElementById(
      "modalPeople"
    ).textContent = `People: ${media.peoplePresent.join(", ")}`;

    // Set rating
    document.getElementById("modalRating").innerHTML =
      media.ratings.length > 0
        ? `${getStarRating(media.averageRating)} (${
            media.ratings.length
          } ratings)`
        : "Not rated yet";

    // Show/hide media elements based on type
    const videoElement = document.getElementById("modalVideo");
    const imageElement = document.getElementById("modalImage");

    const mediaUrl = getMediaUrl(media);

    if (media.fileType === "video") {
      videoElement.src = mediaUrl;
      videoElement.style.display = "block";
      imageElement.style.display = "none";
    } else {
      imageElement.src = mediaUrl;
      imageElement.style.display = "block";
      videoElement.style.display = "none";
    }

    // Load comments
    const commentsListElement = document.getElementById("commentsList");
    commentsListElement.innerHTML = "";

    if (media.comments && media.comments.length > 0) {
      media.comments.forEach((comment) => {
        const commentElement = document.createElement("div");
        commentElement.className = "comment";
        commentElement.innerHTML = `
                    <p class="comment-author">${comment.username}</p>
                    <p class="comment-date">${formatDate(comment.createdAt)}</p>
                    <p class="comment-text">${comment.text}</p>
                `;
        commentsListElement.appendChild(commentElement);
      });
    } else {
      commentsListElement.innerHTML = "<p>No comments yet</p>";
    }

    // Show modal
    document.getElementById("mediaModal").style.display = "block";
  } catch (error) {
    console.error("Error loading media:", error);
    alert("An error occurred while loading the media");
  }
}

async function handleComment(event) {
  event.preventDefault();

  if (!currentUser) {
    alert("You must be logged in to comment");
    return;
  }

  const commentText = document.getElementById("commentText").value;

  if (!commentText.trim()) {
    alert("Comment cannot be empty");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/videos/${currentMediaId}/comment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          username: currentUser.username,
          password: currentUser.password,
        },
        body: JSON.stringify({ text: commentText }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      alert(result.message);
      document.getElementById("commentForm").reset();
      viewMedia(currentMediaId); // Reload media to show the new comment
    } else {
      alert(result.message || "Failed to post comment");
    }
  } catch (error) {
    console.error("Error posting comment:", error);
    alert("An error occurred while posting the comment");
  }
}

async function rateMedia(rating) {
  if (!currentUser) {
    alert("You must be logged in to rate media");
    return;
  }

  if (!currentMediaId) {
    alert("No media selected to rate");
    return;
  }

  try {
    console.log("Rating media:", { mediaId: currentMediaId, rating });
    const response = await fetch(`${API_URL}/videos/${currentMediaId}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        username: currentUser.username,
        password: currentUser.password,
      },
      body: JSON.stringify({ rating }),
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message);
      viewMedia(currentMediaId); // Reload media to update the rating
    } else {
      alert(result.message || "Failed to rate media");
    }
  } catch (error) {
    console.error("Error rating media:", error);
    alert("An error occurred while rating the media");
  }
}
