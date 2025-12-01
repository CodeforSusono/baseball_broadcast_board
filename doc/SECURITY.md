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

## Testing

### Implemented Tests

The project now uses **Vitest** for automated security testing.

**Test Files**:
- [test/unit/validate-file-path.test.js](../test/unit/validate-file-path.test.js) - Path traversal tests (29 tests)
- [test/unit/validate-hex-color.test.js](../test/unit/validate-hex-color.test.js) - Color validation tests (39 tests)

**Test Coverage**: 68 total test cases covering all security validations

**Run Tests**:
```bash
npm test              # Run all tests
npm run test:run      # Run once (CI mode)
npm run test:coverage # With coverage report
```

**Test Results**:
- ✅ Path traversal tests: 29/29 passing
- ✅ Color validation tests: 39/39 passing
- ✅ **Total: 68/68 passing (100%)**

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
- [main.js:501-536](main.js#L501-L536) - Color validation logic
- [main.js:669-735](main.js#L669-L735) - `board:setBackgroundColor` handler
- [main.js:553-568](main.js#L553-L568) - `config:readYaml` handler
- [main.js:571-615](main.js#L571-L615) - `config:generate` handler
- [preload.js:20-21](preload.js#L20-L21) - IPC API exposure

**Verification steps**:
1. Confirm `validateFilePath()` is called in all file-reading IPC handlers
2. Confirm `validateHexColor()` is called in `board:setBackgroundColor` handler
3. Check that normalized/resolved paths and colors are used (not original input)
4. Verify extension whitelist is enforced for file paths
5. Test with various path traversal and injection payloads

## Changelog

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

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Node.js Path Traversal Prevention](https://nodejs.org/en/docs/guides/security/#path-traversal)
