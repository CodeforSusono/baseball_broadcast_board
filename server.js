const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  log: (...args) => {
    if (!isProduction) {
      console.log(...args);
    }
  }
};

// Game state management
const GAME_STATE_FILE = path.resolve("./data/current_game.json");
let currentGameState = null;

/**
 * Load game state from file
 * @returns {object|null} The loaded game state or null if not available
 */
function loadGameState() {
  try {
    if (fs.existsSync(GAME_STATE_FILE)) {
      const data = fs.readFileSync(GAME_STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      logger.log("Game state loaded from file");
      return state;
    }
  } catch (error) {
    console.error("Error loading game state:", error.message);
  }
  return null;
}

/**
 * Save game state to file
 * @param {object} state - The game state to save
 */
function saveGameState(state) {
  try {
    const dataDir = path.dirname(GAME_STATE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(GAME_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    logger.log("Game state saved to file");
  } catch (error) {
    console.error("Error saving game state:", error.message);
  }
}

// Load game state on server startup
currentGameState = loadGameState();

const server = http.createServer((req, res) => {
  const publicDir = path.resolve("./public");
  let requestedUrl = req.url;
  if (requestedUrl === "/") {
    requestedUrl = "/index.html";
  }

  // Special handling for init_data.json - serve from config/
  let intendedPath;
  if (requestedUrl === "/init_data.json") {
    intendedPath = path.resolve("./config/init_data.json");
  } else {
    intendedPath = path.join(publicDir, requestedUrl);
  }
  const filePath = path.resolve(intendedPath);

  // Security check: only allow files from public/ or config/init_data.json
  const configDir = path.resolve("./config");
  const isPublicFile = filePath.startsWith(publicDir);
  const isConfigFile = filePath === path.resolve("./config/init_data.json");

  if (!isPublicFile && !isConfigFile) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
  }
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType =
    {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    }[extname] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404);
        res.end("404 Not Found");
      } else {
        res.writeHead(500);
        res.end(
          "Sorry, check with the site admin for error: " + error.code + " ..\n"
        );
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  logger.log("Client connected");

  // Send current game state to newly connected client
  if (currentGameState) {
    ws.send(JSON.stringify(currentGameState));
    logger.log("Sent current game state to new client");
  }

  ws.on("message", (message) => {
    logger.log("Received: %s", message);

    // Update and save current game state
    try {
      currentGameState = JSON.parse(message.toString());
      saveGameState(currentGameState);
    } catch (error) {
      console.error("Error parsing game state:", error.message);
    }

    // Broadcast to all other connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });
  ws.on("close", () => {
    logger.log("Client disconnected");
  });
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});
server.listen(8080, () => {
  logger.log("Server is listening on port 8080");
});