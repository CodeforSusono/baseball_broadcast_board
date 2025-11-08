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

// Master/Slave client management
const clients = new Map(); // Map<clientId, {ws, type, role, connectedAt}>
let masterClientId = null;
let masterToken = null; // Current valid master token
let masterTokenGracePeriod = null; // {token, expiresAt} for reload grace period
let clientIdCounter = 0;
const RELOAD_GRACE_PERIOD_MS = 5000; // 5 seconds grace period for reload

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

/**
 * Generate unique client ID
 * @returns {string} Unique client ID
 */
function generateClientId() {
  return `client_${++clientIdCounter}_${Date.now()}`;
}

/**
 * Generate unique master token (UUID-like)
 * @returns {string} Unique master token
 */
function generateMasterToken() {
  return `master_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send JSON message to WebSocket client
 * @param {WebSocket} ws - The WebSocket connection
 * @param {object} message - The message object to send
 */
function sendMessage(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast message to specific client types
 * @param {object} message - The message to broadcast
 * @param {function} filter - Optional filter function (client, id) => boolean
 */
function broadcastToClients(message, filter = null) {
  clients.forEach((client, id) => {
    if (filter && !filter(client, id)) return;
    sendMessage(client.ws, message);
  });
}

/**
 * Promote the oldest slave to master
 * @param {string} reason - Reason for promotion ('master_disconnected' or 'master_released')
 * @param {string|null} excludeId - Client ID to exclude from promotion candidates
 * @returns {boolean} True if a slave was promoted
 */
function promoteNextMaster(reason = 'master_disconnected', excludeId = null) {
  const slaves = Array.from(clients.entries())
    .filter(([id, client]) =>
      id !== excludeId &&
      client.type === 'operation' &&
      client.role === 'slave'
    )
    .sort((a, b) => a[1].connectedAt - b[1].connectedAt);

  if (slaves.length > 0) {
    const [newMasterId, newMasterClient] = slaves[0];
    masterClientId = newMasterId;
    newMasterClient.role = 'master';

    // Generate new master token
    masterToken = generateMasterToken();
    logger.log(`Generated new master token: ${masterToken}`);

    // Notify the new master
    sendMessage(newMasterClient.ws, {
      type: 'role_changed',
      newRole: 'master',
      masterToken: masterToken,
      reason: reason
    });

    logger.log(`Client ${newMasterId} promoted to master (reason: ${reason})`);
    return true;
  }
  logger.log('No slaves available for promotion');
  return false;
}

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
  const clientId = generateClientId();
  let clientInfo = null;

  logger.log(`[CONNECTION] Client connected: ${clientId}`);
  logger.log(`[STATE] Current masterClientId: ${masterClientId || 'none'}`);

  // Set connection timeout for handshake
  const handshakeTimeout = setTimeout(() => {
    if (!clientInfo) {
      logger.log(`[TIMEOUT] Client ${clientId} handshake timeout (3s), treating as board/viewer`);
      clientInfo = {
        ws,
        type: 'board',
        role: 'viewer',
        connectedAt: Date.now()
      };
      clients.set(clientId, clientInfo);

      // Send current game state
      if (currentGameState) {
        sendMessage(ws, {
          type: 'game_state',
          data: currentGameState
        });
      }
    }
  }, 3000);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      logger.log(`Received from ${clientId}:`, data.type || 'game_state');

      // Handle handshake
      if (data.type === 'handshake') {
        clearTimeout(handshakeTimeout);

        const clientType = data.client_type || 'board';
        const providedToken = data.masterToken;
        let role = 'viewer';
        let tokenToSend = null;

        // If already registered (e.g., by timeout), update the client info
        const isUpdate = clientInfo !== null;

        if (clientType === 'operation') {
          // Check if client has a valid master token
          const isValidToken = providedToken && providedToken === masterToken;
          const isGracePeriodToken = providedToken &&
            masterTokenGracePeriod &&
            providedToken === masterTokenGracePeriod.token &&
            Date.now() < masterTokenGracePeriod.expiresAt;

          if (isValidToken) {
            // Valid current token - restore as master
            role = 'master';
            masterClientId = clientId;
            tokenToSend = masterToken; // Send back the same token
            logger.log(`Client ${clientId} verified as MASTER (valid token)`);
          } else if (isGracePeriodToken) {
            // Valid token within grace period (reload scenario) - restore as master
            role = 'master';
            masterClientId = clientId;
            masterToken = providedToken; // Restore the token
            tokenToSend = masterToken;
            masterTokenGracePeriod = null; // Clear grace period
            logger.log(`Client ${clientId} verified as MASTER (grace period token, likely reload)`);
          } else if (providedToken) {
            // Invalid token - log and assign as slave
            logger.log(`Client ${clientId} provided invalid token, assigning as SLAVE`);
            role = 'slave';
          } else if (!masterClientId) {
            // No token provided, no existing master - assign as new master
            role = 'master';
            masterClientId = clientId;
            masterToken = generateMasterToken();
            tokenToSend = masterToken;
            logger.log(`Client ${clientId} assigned as MASTER (no existing master)`);
            logger.log(`Generated new master token: ${masterToken}`);
          } else {
            // No token provided, master exists - assign as slave
            role = 'slave';
            logger.log(`Client ${clientId} assigned as SLAVE (master exists: ${masterClientId})`);
          }
        }

        clientInfo = {
          ws,
          type: clientType,
          role,
          connectedAt: clientInfo?.connectedAt || Date.now()
        };
        clients.set(clientId, clientInfo);

        // Send role assignment
        const assignmentMessage = {
          type: 'role_assignment',
          role,
          clientId,
          masterClientId
        };
        if (tokenToSend) {
          assignmentMessage.masterToken = tokenToSend;
        }
        sendMessage(ws, assignmentMessage);

        // Send current game state
        if (currentGameState) {
          sendMessage(ws, {
            type: 'game_state',
            data: currentGameState
          });
        }

        logger.log(`Client ${clientId} ${isUpdate ? 'updated' : 'registered'} as ${clientType}/${role}`);
        return;
      }

      // Handle master release request
      if (data.type === 'release_master' && clientInfo?.role === 'master') {
        logger.log(`Master ${clientId} released control`);

        // Invalidate current master token
        masterToken = null;
        logger.log(`Master token invalidated`);

        masterClientId = null;
        clientInfo.role = 'slave';

        // Promote next master, excluding the former master
        promoteNextMaster('master_released', clientId);

        // Notify the former master of their new role
        sendMessage(ws, {
          type: 'role_changed',
          newRole: 'slave',
          clearToken: true,
          reason: 'master_released'
        });
        return;
      }

      // Handle game state update
      if (data.type === 'game_state_update' || !data.type) {
        const gameData = data.data || data;

        // Only accept updates from master
        if (clientInfo?.role !== 'master') {
          logger.log(`Rejected update from non-master client ${clientId}`);
          return;
        }

        // Update and save current game state
        currentGameState = gameData;
        saveGameState(currentGameState);

        // Broadcast to all other clients
        broadcastToClients(
          { type: 'game_state', data: currentGameState },
          (client, id) => id !== clientId
        );
      }
    } catch (error) {
      console.error(`Error processing message from ${clientId}:`, error.message);
    }
  });

  ws.on("close", () => {
    logger.log(`Client disconnected: ${clientId} (was ${clientInfo?.type}/${clientInfo?.role})`);

    const wasMaster = clientInfo?.role === 'master';
    clients.delete(clientId);

    if (wasMaster) {
      logger.log(`Master disconnected, setting grace period for token (${RELOAD_GRACE_PERIOD_MS}ms)`);

      // Set grace period for the token to allow reload
      masterTokenGracePeriod = {
        token: masterToken,
        expiresAt: Date.now() + RELOAD_GRACE_PERIOD_MS
      };

      masterClientId = null;
      masterToken = null; // Clear current token (but keep grace period)

      // Schedule automatic promotion after grace period
      setTimeout(() => {
        // Only promote if no master reconnected during grace period
        if (!masterClientId && masterTokenGracePeriod) {
          logger.log(`Grace period expired, promoting next slave`);
          masterTokenGracePeriod = null; // Clear grace period
          promoteNextMaster('master_disconnected');
        }
      }, RELOAD_GRACE_PERIOD_MS);
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });
});
server.listen(8080, () => {
  logger.log("Server is listening on port 8080");
});