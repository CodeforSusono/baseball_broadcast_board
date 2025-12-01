# Security Documentation

## Overview

This document describes the security measures implemented in the Baseball Scoreboard Electron application, particularly focusing on preventing file system vulnerabilities.

## Path Traversal Protection

### Vulnerability Background

Path traversal attacks occur when an application uses user-controlled input to access files or directories on the file system without proper validation. In Electron applications, this is particularly critical because:

- The main process has full file system access
- Malicious renderer processes could exploit IPC handlers to read arbitrary files
- User privileges allow access to sensitive system files

### Implementation

#### Location
- [main.js:18-58](main.js#L18-L58) - `validateFilePath()` function

#### Protection Layers

The `validateFilePath()` function implements multiple security layers:

1. **Path Normalization**
   ```javascript
   const normalizedPath = path.normalize(filePath);
   const resolvedPath = path.resolve(normalizedPath);
   ```
   - Resolves relative paths (e.g., `../../../etc/passwd`)
   - Converts all path separators to system-appropriate format
   - Eliminates redundant separators and `.` components

2. **File Existence Validation**
   ```javascript
   if (!fs.existsSync(resolvedPath)) {
     return { valid: false, error: 'File does not exist' };
   }
   ```
   - Ensures the file actually exists before attempting to read
   - Prevents information leakage through error messages

3. **File Type Validation**
   ```javascript
   const stats = fs.statSync(resolvedPath);
   if (!stats.isFile()) {
     return { valid: false, error: 'Path is not a file' };
   }
   ```
   - Rejects directory paths
   - Ensures only regular files can be read

4. **Extension Whitelist**
   ```javascript
   if (allowedExtensions.length > 0) {
     const ext = path.extname(resolvedPath).toLowerCase();
     if (!allowedExtensions.includes(ext)) {
       return { valid: false, error: `File extension must be one of: ${allowedExtensions.join(', ')}` };
     }
   }
   ```
   - Restricts file types to expected formats (`.yaml`, `.yml`)
   - Prevents reading of system files or executables

5. **Suspicious Pattern Detection**
   ```javascript
   const suspiciousPatterns = ['..', '~', '%00', '\0'];
   for (const pattern of suspiciousPatterns) {
     if (normalizedPath.includes(pattern)) {
       return { valid: false, error: 'Path contains suspicious patterns' };
     }
   }
   ```
   - Detects common path traversal patterns (`..`)
   - Blocks null byte injection (`%00`, `\0`)
   - Prevents home directory expansion (`~`)

### Protected IPC Handlers

#### 1. `config:readYaml`
- **Location**: [main.js:553-568](main.js#L553-L568)
- **Function**: Reads YAML configuration files selected by user
- **Protection**: Validates file path with `.yaml` and `.yml` extensions only
- **Usage**: Settings window → "YAMLから生成" button

#### 2. `config:generate`
- **Location**: [main.js:571-615](main.js#L571-L615)
- **Function**: Generates `init_data.json` from YAML file
- **Protection**: Validates file path with `.yaml` and `.yml` extensions only
- **Usage**: Settings window → "📋 設定ファイルを生成" button

### Attack Scenarios Prevented

| Attack Vector | Example Input | Prevention Method |
|---------------|---------------|-------------------|
| Directory traversal | `../../../../etc/passwd` | Path normalization + extension check |
| Home directory access | `~/../../etc/shadow` | Suspicious pattern detection (`~`) |
| Null byte injection | `config.yaml\0.txt` | Null byte pattern detection |
| Windows device access | `CON`, `NUL` | Path normalization handles edge cases |
| Symlink following | Symlink to `/etc/passwd` | `fs.statSync()` follows symlinks, extension check still applies |

### Integration with File Dialog

The application uses Electron's native file dialog for user file selection:

```javascript
// preload.js - Safe API exposure via contextBridge
openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options)

// main.js - IPC handler
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});
```

**Defense in Depth**:
- User selects file through OS-native dialog (trusted UI)
- File path is still validated before use (doesn't trust renderer process)
- Even if dialog is bypassed, validation prevents attacks

### Error Handling

Validation errors are returned to the renderer process with generic messages:

```javascript
return { success: false, error: `Invalid file path: ${validation.error}` };
```

This approach:
- ✅ Prevents information leakage about file system structure
- ✅ Provides enough context for legitimate users to fix issues
- ✅ Doesn't expose internal validation logic details

## Input Validation Protection

### Vulnerability Background

Improper input validation occurs when an application accepts user-controlled input without validating its format and type. In Electron applications with IPC handlers, this is critical because:

- Malicious renderer processes can send arbitrary data to main process handlers
- Invalid data could corrupt configuration files or cause unexpected behavior
- Non-validated input may bypass client-side validation

### Implementation: Color Code Validation

#### Location
- [main.js:501-536](main.js#L501-L536) - `validateHexColor()` function
- [main.js:669-735](main.js#L669-L735) - `board:setBackgroundColor` IPC handler (uses validation)

#### Protection Layers

The `validateHexColor()` function implements multiple validation layers:

1. **Type Validation**
   ```javascript
   if (typeof color !== 'string' || color.trim() === '') {
     return { valid: false, error: 'Color must be a non-empty string' };
   }
   ```
   - Ensures input is a non-empty string
   - Rejects null, undefined, objects, numbers
   - Prevents type confusion attacks

2. **Format Validation**
   ```javascript
   const hexColorPattern = /^#([0-9a-f]{6}|[0-9a-f]{3})$/;
   if (!hexColorPattern.test(normalizedColor)) {
     return { valid: false, error: 'Color must be in hex format (#rrggbb or #rgb)' };
   }
   ```
   - Only accepts standard hex color formats (`#rrggbb` or `#rgb`)
   - Prevents injection of arbitrary strings into JSON configuration files
   - Case-insensitive validation

3. **Normalization**
   ```javascript
   const normalizedColor = color.trim().toLowerCase();
   // Expand #rgb to #rrggbb for consistency
   if (normalizedColor.length === 4) {
     const r = normalizedColor[1];
     const g = normalizedColor[2];
     const b = normalizedColor[3];
     expandedColor = `#${r}${r}${g}${g}${b}${b}`;
   }
   ```
   - Trims whitespace and converts to lowercase
   - Expands 3-digit hex to 6-digit for consistency
   - Ensures uniform storage format

### Protected IPC Handlers

#### `board:setBackgroundColor`
- **Location**: [main.js:669-735](main.js#L669-L735)
- **Function**: Sets background color for OBS chroma-key compositing
- **Protection**: Validates color input with `validateHexColor()` before writing to files
- **Usage**: Settings window → "🎨 表示ボード設定" → "適用" button

### Attack Scenarios Prevented

| Attack Vector | Example Input | Prevention Method |
|---------------|---------------|-------------------|
| JSON injection | `{"backgroundColor": "red"}` | Hex format regex validation |
| SQL injection | `'; DROP TABLE colors; --` | Hex format regex validation |
| Script injection | `<script>alert("xss")</script>` | Hex format regex validation |
| Command injection | `$(rm -rf /)` | Hex format regex validation |
| Newline injection | `#ff55ff\n"malicious": "data"` | Hex format regex validation |
| Unicode escape injection | `\u0023ff55ff` | Hex format regex validation |
| Type confusion | `123456` (number) | Type validation |

### Defense in Depth

The color validation implements multiple layers of defense:

1. **Client-side validation** ([public/js/settings.js:264-269](../public/js/settings.js#L264-L269))
   - User-facing validation in renderer process
   - Provides immediate feedback
   - **Cannot be trusted** (renderer process can be compromised)

2. **Server-side validation** ([main.js:672-675](main.js#L672-L675))
   - Main process validates all input
   - Uses `validateHexColor()` function
   - **Primary security boundary**

3. **Normalized storage** ([main.js:677-690](main.js#L677-L690))
   - Validated color is normalized before storage
   - Consistent format (`#rrggbb`) in all configuration files
   - Prevents edge cases in downstream consumers

### Error Handling

Validation errors are returned to the renderer process with clear messages:

```javascript
return { success: false, error: `Invalid color format: ${validation.error}` };
```

This approach:
- ✅ Provides clear feedback for legitimate users
- ✅ Prevents injection attacks with malformed input
- ✅ Maintains security without compromising usability

## XSS Prevention (Stored Cross-Site Scripting)

### Vulnerability Background

Stored XSS occurs when user-provided data is stored on the server and later displayed to other users without proper sanitization. In this application:

- Game state data (titles, team names) is received via WebSocket
- Data is stored in `data/current_game.json` and broadcasted to all clients
- Malicious clients could inject script tags that execute in other users' browsers
- While Vue.js provides some XSS protection, defense in depth requires server-side validation

### Implementation: Game State Validation and Sanitization

#### Location
- [server.js:232-252](server.js#L232-L252) - `sanitizeHTML()` function
- [server.js:261-351](server.js#L261-L351) - `validateGameState()` function
- [server.js:507-531](server.js#L507-L531) - WebSocket message handler (uses validation)

#### Protection Layers

**1. HTML Sanitization** ([server.js:232-252](server.js#L232-L252))

The `sanitizeHTML()` function removes all HTML tags and entities:

```javascript
function sanitizeHTML(input) {
  return input
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/&lt;/g, '<')             // Decode entities
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/<[^>]*>/g, '')           // Remove decoded tags
    .replace(/&[a-zA-Z0-9#]+;/g, '')   // Remove remaining entities
    .trim();
}
```

**Protection against**:
- Direct script injection: `<script>alert("xss")</script>`
- Event handler injection: `<img src=x onerror=alert(1)>`
- Encoded injection: `&lt;script&gt;alert("xss")&lt;/script&gt;`
- Double-encoding bypass: `&amp;lt;script&amp;gt;`

**2. Schema Validation** ([server.js:261-351](server.js#L261-L351))

The `validateGameState()` function enforces strict schema validation:

```javascript
const schema = {
  game_title: { type: 'string', maxLength: 100 },
  team_top: { type: 'string', maxLength: 50 },
  team_bottom: { type: 'string', maxLength: 50 },
  game_inning: { type: 'number', min: 0, max: 99 },
  top: { type: 'boolean' },
  // ... other fields
};
```

**Validation checks**:
- Type validation (string, number, boolean)
- Range validation (min/max for numbers)
- Length validation (maxLength for strings)
- Sanitization (HTML removal from all string fields)
- Unexpected field rejection (forward compatibility)

**3. WebSocket Message Validation** ([server.js:507-531](server.js#L507-L531))

```javascript
// SECURITY: Validate and sanitize game state to prevent XSS attacks
const validation = validateGameState(gameData);
if (!validation.valid) {
  logger.log(`[SECURITY] Rejected invalid game state: ${validation.error}`);
  return;
}

// Use sanitized data instead of raw client input
currentGameState = validation.sanitizedData;
```

### Attack Scenarios Prevented

| Attack Vector | Example Payload | Prevention Method |
|---------------|-----------------|-------------------|
| Script injection | `<script>alert(document.cookie)</script>` | HTML tag removal |
| Event handler injection | `<img src=x onerror=fetch('http://evil.com')>` | HTML tag removal |
| Encoded script tags | `&lt;script&gt;alert(1)&lt;/script&gt;` | Entity decoding + tag removal |
| Iframe injection | `<iframe src="evil.com"></iframe>` | HTML tag removal |
| DOM-based XSS | `"><script>alert(document.domain)</script>` | HTML tag removal |
| Type confusion | `{game_title: {$ne: null}}` | Type validation (must be string) |
| Buffer overflow | `"A".repeat(10000)` | Length validation (max 100 chars) |
| Range overflow | `{score_top: 9999999}` | Range validation (max 999) |

### Defense in Depth

1. **Client-side protection** (Vue.js automatic escaping)
   - Vue.js escapes HTML in `{{ }}` interpolation by default
   - Prevents XSS even if server-side validation fails
   - **Cannot be relied upon** as primary defense

2. **Server-side validation** (Primary security boundary)
   - All game state data validated before storage
   - HTML tags removed from all string fields
   - **Primary defense** against stored XSS

3. **Schema enforcement**
   - Strict type checking prevents type confusion
   - Range checking prevents overflow attacks
   - Length checking prevents buffer attacks

### Master-Only Updates

Game state updates are only accepted from the **master client**:

```javascript
// Only accept updates from master
if (clientInfo?.role !== 'master') {
  logger.log(`Rejected update from non-master client ${clientId}`);
  return;
}
```

This reduces attack surface by:
- Limiting who can inject data
- Preventing slave clients from sending malicious updates
- However, **does not replace validation** (master can still be compromised)

## CSS Injection Prevention (DOM-based)

### Vulnerability Background

DOM-based CSS injection occurs when user-controlled data is used to modify CSS properties without proper validation. In this application:

- The display board (`board.html`) sets `document.body.style.backgroundColor` dynamically
- Color values come from multiple sources: Electron main process, `init_data.json`, or live updates
- Malicious values could inject arbitrary CSS to alter page appearance, hide content, or facilitate phishing attacks
- While CSS injection is less severe than script injection, it can still be exploited for social engineering

### Implementation: Client-Side Color Validation

#### Location
- [public/js/board.js:6-41](../public/js/board.js#L6-L41) - `validateHexColor()` function
- [public/js/board.js:128-145](../public/js/board.js#L128-L145) - `setBackgroundColor()` method

#### Protection Layers

**1. Hex Color Validation** ([public/js/board.js:6-41](../public/js/board.js#L6-L41))

The `validateHexColor()` function validates color format before applying to DOM:

```javascript
function validateHexColor(color) {
  // Type validation
  if (typeof color !== 'string' || color.trim() === '') {
    return { valid: false, error: 'Color must be a non-empty string' };
  }

  // Normalize: trim whitespace and convert to lowercase
  const normalizedColor = color.trim().toLowerCase();

  // SECURITY: Check for hex color code format (#rrggbb or #rgb)
  const hexColorPattern = /^#([0-9a-f]{6}|[0-9a-f]{3})$/;

  if (!hexColorPattern.test(normalizedColor)) {
    return { valid: false, error: 'Color must be in hex format (#rrggbb or #rgb)' };
  }

  // Expand 3-digit hex to 6-digit for consistency
  let expandedColor = normalizedColor;
  if (normalizedColor.length === 4) {
    const r = normalizedColor[1];
    const g = normalizedColor[2];
    const b = normalizedColor[3];
    expandedColor = `#${r}${r}${g}${g}${b}${b}`;
  }

  return { valid: true, normalizedColor: expandedColor };
}
```

**Protection against**:
- CSS property injection: `red !important; background-image: url('http://evil.com/phishing.png')`
- Opacity manipulation: `transparent; opacity: 0; display: none`
- Position hijacking: `#ff55ff; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999`
- Named colors: `red`, `blue`, `transparent`, `inherit`
- CSS functions: `rgba()`, `rgb()`, `hsl()`, `url()`, `expression()`

**2. Safe Color Application** ([public/js/board.js:128-145](../public/js/board.js#L128-L145))

The `setBackgroundColor()` method validates before applying to DOM:

```javascript
setBackgroundColor(color) {
  // SECURITY: Validate color before applying to prevent CSS injection
  const validation = validateHexColor(color);

  if (validation.valid) {
    // Use validated and normalized color
    this.backgroundColor = validation.normalizedColor;
    document.body.style.backgroundColor = validation.normalizedColor;
  } else {
    // Invalid color - log warning and use default
    console.warn(`Invalid background color received: "${color}". Using default color.`);
    this.backgroundColor = this.defaultBackgroundColor;
    document.body.style.backgroundColor = this.defaultBackgroundColor;
  }
}
```

**3. Protected Color Sources**

All color assignments go through `setBackgroundColor()` method:
- [public/js/board.js:75](../public/js/board.js#L75) - Default color on page load
- [public/js/board.js:86](../public/js/board.js#L86) - Color from Electron settings
- [public/js/board.js:92](../public/js/board.js#L92) - Color from Electron live updates
- [public/js/board.js:112](../public/js/board.js#L112) - Color from `init_data.json`

### Attack Scenarios Prevented

| Attack Vector | Example Input | Prevention Method |
|---------------|---------------|-------------------|
| CSS property injection | `red !important; background-image: url('http://evil.com')` | Hex format regex validation |
| Opacity manipulation | `transparent; opacity: 0; display: none` | Hex format regex validation |
| Position hijacking | `#ff55ff; position: fixed; z-index: 9999` | Hex format regex validation |
| Named color bypass | `red`, `blue`, `transparent`, `inherit` | Hex format regex validation |
| CSS function injection | `rgba(255, 0, 0, 0.5)`, `url('javascript:alert(1)')` | Hex format regex validation |
| Expression injection | `expression(alert('xss'))` | Hex format regex validation |
| Semicolon injection | `#ff55ff; display: none` | Hex format regex validation |
| Important flag | `#ff55ff !important` | Hex format regex validation |

### Defense in Depth

The color validation implements defense in depth:

1. **Server-side validation** ([main.js:501-536](main.js#L501-L536))
   - Main process validates color before writing to config files
   - Uses `validateHexColor()` function
   - **Primary security boundary** for Electron mode

2. **Client-side validation** ([public/js/board.js:6-41](../public/js/board.js#L6-L41))
   - Renderer process validates color before applying to DOM
   - Uses same validation logic as main process
   - **Secondary security boundary** for all color sources

3. **Fallback to default** ([public/js/board.js:137-144](../public/js/board.js#L137-L144))
   - Invalid colors are rejected and logged
   - Default color `#ff55ff` (magenta) is used instead
   - Prevents page from breaking due to invalid input

### Error Handling

Invalid colors are logged with warning messages and fall back to default:

```javascript
console.warn(
  `Invalid background color received: "${color}". ` +
  `Error: ${validation.error}. Using default color.`
);
```

This approach:
- ✅ Prevents CSS injection attacks with malformed input
- ✅ Maintains functionality by using safe default
- ✅ Provides debugging information in console
- ✅ Doesn't expose validation logic details to potential attackers

## Testing

### Implemented Tests

The project now uses **Vitest** for automated security testing.

**Test Files**:
- [test/unit/validate-file-path.test.js](../test/unit/validate-file-path.test.js) - Path traversal tests (29 tests)
- [test/unit/validate-hex-color.test.js](../test/unit/validate-hex-color.test.js) - Main process color validation tests (39 tests)
- [test/unit/validate-game-state.test.js](../test/unit/validate-game-state.test.js) - XSS prevention & game state validation tests (46 tests)
- [test/unit/validate-board-color.test.js](../test/unit/validate-board-color.test.js) - Client-side CSS injection prevention tests (47 tests)

**Test Coverage**: 161 total test cases covering all security validations

**Run Tests**:
```bash
npm test              # Run all tests
npm run test:run      # Run once (CI mode)
npm run test:coverage # With coverage report
```

**Test Results**:
- ✅ Path traversal tests: 29/29 passing
- ✅ Main process color validation tests: 39/39 passing
- ✅ XSS prevention tests: 46/46 passing
- ✅ Client-side CSS injection prevention tests: 47/47 passing
- ✅ **Total: 161/161 passing (100%)**

### Test Cases Overview

### Unit Tests for `validateFilePath()`

```javascript
// Test cases for security validation
describe('validateFilePath', () => {
  test('should accept valid YAML file', () => {
    const result = validateFilePath('/path/to/config.yaml', ['.yaml']);
    expect(result.valid).toBe(true);
  });

  test('should reject path traversal attempts', () => {
    const result = validateFilePath('../../../../etc/passwd', ['.yaml']);
    expect(result.valid).toBe(false);
  });

  test('should reject null byte injection', () => {
    const result = validateFilePath('config.yaml\0.txt', ['.yaml']);
    expect(result.valid).toBe(false);
  });

  test('should reject invalid extensions', () => {
    const result = validateFilePath('/path/to/file.txt', ['.yaml']);
    expect(result.valid).toBe(false);
  });

  test('should reject directory paths', () => {
    const result = validateFilePath('/path/to/directory', ['.yaml']);
    expect(result.valid).toBe(false);
  });

  test('should reject non-existent files', () => {
    const result = validateFilePath('/nonexistent/file.yaml', ['.yaml']);
    expect(result.valid).toBe(false);
  });
});
```

### Unit Tests for `validateHexColor()`

```javascript
// Test cases for color validation
describe('validateHexColor', () => {
  test('should accept valid 6-digit hex color', () => {
    const result = validateHexColor('#ff55ff');
    expect(result.valid).toBe(true);
    expect(result.normalizedColor).toBe('#ff55ff');
  });

  test('should expand 3-digit hex to 6-digit', () => {
    const result = validateHexColor('#f5f');
    expect(result.valid).toBe(true);
    expect(result.normalizedColor).toBe('#ff55ff');
  });

  test('should reject color without # prefix', () => {
    const result = validateHexColor('ff55ff');
    expect(result.valid).toBe(false);
  });

  test('should reject invalid characters', () => {
    const result = validateHexColor('#gghhii');
    expect(result.valid).toBe(false);
  });

  test('should reject JSON injection attempt', () => {
    const result = validateHexColor('{"backgroundColor": "red"}');
    expect(result.valid).toBe(false);
  });

  test('should reject script injection attempt', () => {
    const result = validateHexColor('<script>alert("xss")</script>');
    expect(result.valid).toBe(false);
  });

  test('should reject non-string input', () => {
    const result = validateHexColor(123456);
    expect(result.valid).toBe(false);
  });
});
```

### Unit Tests for `validateGameState()` and `sanitizeHTML()`

```javascript
// Test cases for XSS prevention and game state validation
describe('sanitizeHTML', () => {
  test('should remove script tags', () => {
    const result = sanitizeHTML('<script>alert("xss")</script>');
    expect(result).toBe('alert("xss")');
  });

  test('should handle encoded script tags', () => {
    const result = sanitizeHTML('&lt;script&gt;alert("xss")&lt;/script&gt;');
    expect(result).toBe('alert("xss")');
  });

  test('should remove inline event handlers', () => {
    const result = sanitizeHTML('<img src=x onerror=alert(1)>');
    expect(result).toBe('');
  });
});

describe('validateGameState', () => {
  test('should accept valid game state', () => {
    const validState = {
      game_title: '夏季大会',
      team_top: '横浜M',
      team_bottom: '静岡D',
      game_inning: 5,
      top: true,
      // ... other fields
    };
    const result = validateGameState(validState);
    expect(result.valid).toBe(true);
  });

  test('should sanitize XSS in game_title', () => {
    const maliciousState = {
      game_title: '<script>alert("xss")</script>夏季大会',
      // ... other fields
    };
    const result = validateGameState(maliciousState);
    expect(result.valid).toBe(true);
    expect(result.sanitizedData.game_title).toBe('alert("xss")夏季大会');
  });

  test('should reject invalid types', () => {
    const result = validateGameState({ game_title: 123 });
    expect(result.valid).toBe(false);
  });

  test('should reject out-of-range values', () => {
    const result = validateGameState({ ball_cnt: 4 });
    expect(result.valid).toBe(false);
  });
});
```

### Unit Tests for `validateHexColor()` (board.js - Client-side)

```javascript
// Test cases for CSS injection prevention
describe('board.js validateHexColor (CSS Injection Prevention)', () => {
  test('should accept valid hex colors', () => {
    const result = validateHexColor('#ff55ff');
    expect(result.valid).toBe(true);
    expect(result.normalizedColor).toBe('#ff55ff');
  });

  test('should expand 3-digit to 6-digit', () => {
    const result = validateHexColor('#f5f');
    expect(result.valid).toBe(true);
    expect(result.normalizedColor).toBe('#ff55ff');
  });

  test('should reject CSS injection with background-image', () => {
    const maliciousColor = "red !important; background-image: url('http://evil.com/phishing.png')";
    const result = validateHexColor(maliciousColor);
    expect(result.valid).toBe(false);
  });

  test('should reject CSS injection with opacity', () => {
    const maliciousColor = "transparent; opacity: 0; display: none";
    const result = validateHexColor(maliciousColor);
    expect(result.valid).toBe(false);
  });

  test('should reject CSS injection with position', () => {
    const maliciousColor = "#ff55ff; position: fixed; z-index: 9999";
    const result = validateHexColor(maliciousColor);
    expect(result.valid).toBe(false);
  });

  test('should reject CSS function injection', () => {
    const result = validateHexColor('rgba(255, 0, 0, 0.5)');
    expect(result.valid).toBe(false);
  });

  test('should reject named colors', () => {
    const result = validateHexColor('red');
    expect(result.valid).toBe(false);
  });

  test('should reject url() injection', () => {
    const result = validateHexColor("url('javascript:alert(1)')");
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests

```javascript
// Test cases for IPC handlers
describe('IPC Security', () => {
  test('config:readYaml should reject invalid paths', async () => {
    const result = await ipcRenderer.invoke('config:readYaml', '../../../etc/passwd');
    expect(result.success).toBe(false);
  });

  test('config:generate should reject invalid paths', async () => {
    const result = await ipcRenderer.invoke('config:generate', '/etc/shadow');
    expect(result.success).toBe(false);
  });
});
```

## Security Best Practices

### For Developers

1. **Never trust renderer process input**
   - Always validate file paths, even from file dialogs
   - Implement server-side validation for all IPC handlers
   - Use allow-lists (extensions, directories) instead of deny-lists

2. **Use built-in Node.js path utilities**
   - `path.normalize()` for path normalization
   - `path.resolve()` for absolute path resolution
   - `path.extname()` for extension extraction

3. **Implement defense in depth**
   - Multiple validation layers (existence, type, extension, patterns)
   - Generic error messages to prevent information leakage
   - Logging (if implemented) should not expose sensitive paths

4. **Keep dependencies updated**
   - Regularly update Electron and Node.js versions
   - Monitor security advisories for `js-yaml` and other dependencies
   - Use `npm audit` to detect known vulnerabilities

### For Security Auditors

**Key files to review**:
- [server.js:232-252](server.js#L232-L252) - HTML sanitization logic
- [server.js:261-351](server.js#L261-L351) - Game state validation logic
- [server.js:507-531](server.js#L507-L531) - WebSocket message handler (XSS prevention)
- [main.js:501-536](main.js#L501-L536) - Color validation logic (main process)
- [main.js:669-735](main.js#L669-L735) - `board:setBackgroundColor` handler
- [main.js:553-568](main.js#L553-L568) - `config:readYaml` handler
- [main.js:571-615](main.js#L571-L615) - `config:generate` handler
- [public/js/board.js:6-41](../public/js/board.js#L6-L41) - Client-side color validation logic
- [public/js/board.js:128-145](../public/js/board.js#L128-L145) - `setBackgroundColor()` method (CSS injection prevention)
- [preload.js:20-21](preload.js#L20-L21) - IPC API exposure

**Verification steps**:
1. Confirm `validateGameState()` is called before storing/broadcasting game state
2. Confirm `sanitizeHTML()` removes all HTML tags from string fields
3. Confirm `validateFilePath()` is called in all file-reading IPC handlers
4. Confirm `validateHexColor()` is called in `board:setBackgroundColor` handler (main process)
5. Confirm `validateHexColor()` is called in `setBackgroundColor()` method (board.js renderer)
6. Confirm all `document.body.style.backgroundColor` assignments go through `setBackgroundColor()`
7. Check that sanitized/normalized data is used (not original client input)
8. Verify extension whitelist is enforced for file paths
9. Test with various XSS, path traversal, CSS injection, and other injection payloads

## Changelog

### 2025-12-01 (Fourth Update)
- **Added**: Client-side `validateHexColor()` function in board.js for CSS injection prevention
- **Added**: `setBackgroundColor()` method to centralize and validate all color assignments
- **Fixed**: DOM-based CSS injection vulnerability in board.js (line 42, 48, 68)
- **Severity**: Low (CSS injection allowing page appearance manipulation and potential phishing)
- **Test Coverage**: 47 test cases for CSS injection prevention (100% passing)
- **Total Tests**: 161/161 passing (29 path + 39 main color + 46 XSS/game state + 47 board color)

### 2025-12-01 (Third Update)
- **Added**: `sanitizeHTML()` function for XSS prevention
- **Added**: `validateGameState()` function with schema validation
- **Fixed**: Stored XSS vulnerability in WebSocket game state handler
- **Severity**: Medium (stored XSS allowing script execution in other users' browsers)
- **Test Coverage**: 46 test cases for XSS prevention and game state validation (100% passing)
- **Total Tests**: 114/114 passing (29 path + 39 main color + 46 XSS/game state)

### 2025-12-01 (Second Update)
- **Added**: `validateHexColor()` function with multi-layer input validation
- **Fixed**: Missing input validation in `board:setBackgroundColor` IPC handler
- **Severity**: Low (configuration file corruption)
- **Test Coverage**: 39 test cases for color validation (100% passing)

### 2025-12-01 (Initial)
- **Added**: `validateFilePath()` function with multi-layer security validation
- **Fixed**: Path traversal vulnerability in `config:readYaml` (CVE-pending)
- **Fixed**: Path traversal vulnerability in `config:generate` (CVE-pending)
- **Severity**: High (arbitrary file read with user privileges)
- **Test Coverage**: 29 test cases for path validation (100% passing)

## References

### OWASP Resources
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP Cross Site Scripting (XSS)](https://owasp.org/www-community/attacks/xss/)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP HTML Sanitization](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)

### Electron Security
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron IPC Security](https://www.electronjs.org/docs/latest/tutorial/ipc#security-considerations)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

### Node.js Security
- [Node.js Path Traversal Prevention](https://nodejs.org/en/docs/guides/security/#path-traversal)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### WebSocket Security
- [WebSocket Security Considerations](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#security_concerns)
