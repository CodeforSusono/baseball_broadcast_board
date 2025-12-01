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
// In packaged Electron apps, use USER_DATA_PATH for writable data
// In development, use local data directory
const DATA_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "data")
  : path.join(__dirname, "data");
const GAME_STATE_FILE = path.join(DATA_DIR, "current_game.json");

// Config file management
// Similar to game state, use writable location for init_data.json
const CONFIG_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "config")
  : path.join(__dirname, "config");
const INIT_DATA_FILE = path.join(CONFIG_DIR, "init_data.json");
const BUNDLED_INIT_DATA_FILE = path.join(__dirname, "config", "init_data.json");

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
  logger.log(`[HTTP] ${req.method} ${req.url}`);

  // Use __dirname for reliable path resolution in both development and packaged apps
  const publicDir = path.join(__dirname, "public");
  let requestedUrl = req.url;
  if (requestedUrl === "/") {
    requestedUrl = "/index.html";
  }

  // Special handling for init_data.json - serve from writable location or bundled
  let intendedPath;
  if (requestedUrl === "/init_data.json") {
    // Priority: writable user config > bundled config
    if (fs.existsSync(INIT_DATA_FILE)) {
      intendedPath = INIT_DATA_FILE;
    } else {
      intendedPath = BUNDLED_INIT_DATA_FILE;
    }
  } else {
    intendedPath = path.join(publicDir, requestedUrl);
  }
  const filePath = path.resolve(intendedPath);

  // Security check: only allow files from public/, user config, or bundled config
  const isPublicFile = filePath.startsWith(publicDir);
  const isUserConfigFile = filePath === path.resolve(INIT_DATA_FILE);
  const isBundledConfigFile = filePath === path.resolve(BUNDLED_INIT_DATA_FILE);

  if (!isPublicFile && !isUserConfigFile && !isBundledConfigFile) {
      console.error(`[SECURITY] Access denied to ${filePath}`);
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
      console.error(`[HTTP] Failed to read ${requestedUrl}:`, error.code);
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
      logger.log(`[HTTP] Served ${requestedUrl}`);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

/**
 * Sanitize HTML string to prevent XSS attacks
 * SECURITY: Remove all HTML tags and decode HTML entities
 *
 * @param {string} input - String to sanitize
 * @returns {string} - Sanitized string with HTML removed
 */
function sanitizeHTML(input) {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities to prevent double-encoding bypass
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    // Remove the decoded tags (in case of encoded script tags)
    .replace(/<[^>]*>/g, '')
    // Remove any remaining HTML entities
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    // Trim whitespace
    .trim();
}

/**
 * Validate and sanitize game state data
 * SECURITY: Prevent XSS, type confusion, and invalid data injection
 *
 * @param {Object} gameData - Game state data from client
 * @returns {Object} - Validation result {valid: boolean, error?: string, sanitizedData?: Object}
 */
function validateGameState(gameData) {
  try {
    // Check if gameData is an object
    if (typeof gameData !== 'object' || gameData === null || Array.isArray(gameData)) {
      return { valid: false, error: 'Game data must be a non-null object' };
    }

    // Define expected schema with types and constraints
    const schema = {
      game_title: { type: 'string', maxLength: 100 },
      team_top: { type: 'string', maxLength: 50 },
      team_bottom: { type: 'string', maxLength: 50 },
      game_inning: { type: 'number', min: 0, max: 99 },
      top: { type: 'boolean' },
      first_base: { type: 'boolean' },
      second_base: { type: 'boolean' },
      third_base: { type: 'boolean' },
      ball_cnt: { type: 'number', min: 0, max: 3 },
      strike_cnt: { type: 'number', min: 0, max: 2 },
      out_cnt: { type: 'number', min: 0, max: 2 },
      score_top: { type: 'number', min: 0, max: 999 },
      score_bottom: { type: 'number', min: 0, max: 999 },
      last_inning: { type: 'number', min: 1, max: 99 }
    };

    const sanitizedData = {};

    // Validate each field
    for (const [field, rules] of Object.entries(schema)) {
      const value = gameData[field];

      // Check type
      if (rules.type === 'string') {
        if (typeof value !== 'string') {
          return { valid: false, error: `Field '${field}' must be a string` };
        }

        // Check max length
        if (rules.maxLength && value.length > rules.maxLength) {
          return {
            valid: false,
            error: `Field '${field}' exceeds maximum length of ${rules.maxLength}`
          };
        }

        // Sanitize HTML
        sanitizedData[field] = sanitizeHTML(value);

      } else if (rules.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return { valid: false, error: `Field '${field}' must be a finite number` };
        }

        // Check range
        if (rules.min !== undefined && value < rules.min) {
          return {
            valid: false,
            error: `Field '${field}' must be at least ${rules.min}`
          };
        }
        if (rules.max !== undefined && value > rules.max) {
          return {
            valid: false,
            error: `Field '${field}' must be at most ${rules.max}`
          };
        }

        // Round to integer for count fields
        sanitizedData[field] = Math.round(value);

      } else if (rules.type === 'boolean') {
        if (typeof value !== 'boolean') {
          return { valid: false, error: `Field '${field}' must be a boolean` };
        }
        sanitizedData[field] = value;
      }
    }

    // Check for unexpected fields (strict schema enforcement)
    const unexpectedFields = Object.keys(gameData).filter(key => !schema[key]);
    if (unexpectedFields.length > 0) {
      logger.log(`[VALIDATION] Ignoring unexpected fields: ${unexpectedFields.join(', ')}`);
      // Don't reject, just ignore unexpected fields for forward compatibility
    }

    return { valid: true, sanitizedData };

  } catch (error) {
    return { valid: false, error: error.message };
  }
}

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

        // SECURITY: Validate and sanitize game state to prevent XSS attacks
        const validation = validateGameState(gameData);
        if (!validation.valid) {
          logger.log(`[SECURITY] Rejected invalid game state from ${clientId}: ${validation.error}`);
          sendMessage(ws, {
            type: 'error',
            message: 'Invalid game state data',
            error: validation.error
          });
          return;
        }

        // Use sanitized data instead of raw client input
        const sanitizedGameData = validation.sanitizedData;

        // Update and save current game state
        currentGameState = sanitizedGameData;
        saveGameState(currentGameState);

        // Broadcast sanitized data to all other clients
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
  console.log("Server is listening on port 8080");
  if (!isProduction) {
    console.log("DATA_DIR:", DATA_DIR);
    console.log("GAME_STATE_FILE:", GAME_STATE_FILE);
  }
});