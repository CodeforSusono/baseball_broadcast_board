/**
 * Path Traversal Security Tests
 *
 * Tests for validateFilePath() function to prevent path traversal attacks
 * in Electron IPC handlers (config:readYaml, config:generate)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * validateFilePath function (copied from main.js for testing)
 * This is the same implementation as in main.js:18-58
 */
function validateFilePath(filePath, allowedExtensions = []) {
  try {
    // SECURITY: Check for suspicious patterns BEFORE normalization
    // This prevents path traversal attacks from being resolved away
    const suspiciousPatterns = ['..', '~', '%00', '\0'];
    for (const pattern of suspiciousPatterns) {
      if (filePath.includes(pattern)) {
        return { valid: false, error: 'Path contains suspicious patterns' };
      }
    }

    // Normalize and resolve the path
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(normalizedPath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, error: 'File does not exist' };
    }

    // Check if it's a file (not a directory)
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }

    // Check file extension if specified
    if (allowedExtensions.length > 0) {
      const ext = path.extname(resolvedPath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return {
          valid: false,
          error: `File extension must be one of: ${allowedExtensions.join(', ')}`
        };
      }
    }

    return { valid: true, normalizedPath: resolvedPath };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

describe('Path Traversal Security Tests', () => {
  let tempYamlFile;
  let tempDir;

  beforeAll(() => {
    // Create a temporary directory and YAML file for testing
    tempDir = path.join(__dirname, 'temp-test-files');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    tempYamlFile = path.join(tempDir, 'test-config.yaml');
    fs.writeFileSync(tempYamlFile, 'test: data\ngame_title: Test Game', 'utf8');
  });

  afterAll(() => {
    // Clean up temporary files
    if (fs.existsSync(tempYamlFile)) {
      fs.unlinkSync(tempYamlFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  describe('Valid Files', () => {
    it('should accept valid YAML file with .yaml extension', () => {
      const result = validateFilePath(tempYamlFile, ['.yaml', '.yml']);
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBeDefined();
      expect(result.normalizedPath).toContain('test-config.yaml');
    });

    it('should accept valid YAML file with .yml extension', () => {
      const ymlFile = path.join(tempDir, 'test-config.yml');
      fs.writeFileSync(ymlFile, 'test: data', 'utf8');

      const result = validateFilePath(ymlFile, ['.yaml', '.yml']);
      expect(result.valid).toBe(true);

      fs.unlinkSync(ymlFile);
    });

    it('should accept file when no extension filter is specified', () => {
      const result = validateFilePath(tempYamlFile, []);
      expect(result.valid).toBe(true);
    });

    it('should normalize and resolve relative paths correctly', () => {
      const relativePath = path.join('test', 'unit', 'temp-test-files', 'test-config.yaml');
      const result = validateFilePath(relativePath, ['.yaml', '.yml']);

      expect(result.valid).toBe(true);
      expect(path.isAbsolute(result.normalizedPath)).toBe(true);
    });
  });

  describe('Path Traversal Attacks', () => {
    it('should reject path traversal with ../ patterns', () => {
      const result = validateFilePath('../../../../etc/passwd', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject path traversal with valid extension appended', () => {
      const result = validateFilePath('../../../etc/passwd.yaml', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
    });

    it('should reject path with .. pattern (string literal)', () => {
      // Using string literal instead of path.join to preserve .. pattern
      const maliciousPath = __dirname + '/../../../etc/passwd';
      const result = validateFilePath(maliciousPath, ['.yaml']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('suspicious patterns');
    });

    it('should reject complex path traversal attempts', () => {
      const attacks = [
        '../../../../../../etc/shadow',
        '../../../root/.ssh/id_rsa',
        '..\\..\\..\\windows\\system32\\config\\sam', // Windows-style
        'config/../../etc/passwd',
      ];

      attacks.forEach(attack => {
        const result = validateFilePath(attack, ['.yaml', '.yml']);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Invalid File Extensions', () => {
    it('should reject .json file when .yaml is required', () => {
      const jsonFile = path.join(__dirname, '..', '..', 'package.json');
      const result = validateFilePath(jsonFile, ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File extension must be one of');
      expect(result.error).toContain('.yaml');
    });

    it('should reject .txt file', () => {
      const txtFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(txtFile, 'test', 'utf8');

      const result = validateFilePath(txtFile, ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('extension');

      fs.unlinkSync(txtFile);
    });

    it('should reject .js file when YAML is required', () => {
      const jsFile = path.join(__dirname, '..', '..', 'main.js');
      const result = validateFilePath(jsFile, ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
    });

    it('should be case-insensitive for extensions', () => {
      const yamlFileUpper = path.join(tempDir, 'test-upper.YAML');
      fs.writeFileSync(yamlFileUpper, 'test: data', 'utf8');

      const result = validateFilePath(yamlFileUpper, ['.yaml', '.yml']);
      expect(result.valid).toBe(true);

      fs.unlinkSync(yamlFileUpper);
    });
  });

  describe('Invalid File Types', () => {
    it('should reject directory paths', () => {
      const dirPath = tempDir;
      const result = validateFilePath(dirPath, ['.yaml']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path is not a file');
    });

    it('should reject system directories', () => {
      const systemDirs = [
        '/etc',
        '/var',
        '/tmp',
      ];

      systemDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          const result = validateFilePath(dir, ['.yaml']);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Path is not a file');
        }
      });
    });
  });

  describe('Non-existent Files', () => {
    it('should reject non-existent file', () => {
      const result = validateFilePath('/nonexistent/path/file.yaml', ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File does not exist');
    });

    it('should reject file in non-existent directory', () => {
      const result = validateFilePath('/tmp/nonexistent-dir-123456/config.yaml', ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
    });
  });

  describe('Suspicious Patterns', () => {
    it('should reject paths with tilde (~)', () => {
      const result = validateFilePath('~/test.yaml', ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path contains suspicious patterns');
    });

    it('should reject paths with null byte (%00)', () => {
      const result = validateFilePath('test.yaml%00.txt', ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path contains suspicious patterns');
    });

    it('should reject paths with null character (\\0)', () => {
      const maliciousPath = 'test.yaml\0.txt';
      const result = validateFilePath(maliciousPath, ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path contains suspicious patterns');
    });

    it('should reject all suspicious patterns', () => {
      const suspiciousInputs = [
        'config/~/test.yaml',
        'config/../test.yaml',
        'test%00.yaml',
        'test\0.yaml',
      ];

      suspiciousInputs.forEach(input => {
        const result = validateFilePath(input, ['.yaml', '.yml']);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Path contains suspicious patterns');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string input', () => {
      const result = validateFilePath('', ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      const result = validateFilePath('   ', ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
    });

    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(100) + 'test.yaml';
      const result = validateFilePath(longPath, ['.yaml', '.yml']);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File does not exist');
    });

    it('should handle special characters in filename', () => {
      const specialFile = path.join(tempDir, 'test-config-@#$%.yaml');
      fs.writeFileSync(specialFile, 'test: data', 'utf8');

      const result = validateFilePath(specialFile, ['.yaml', '.yml']);
      expect(result.valid).toBe(true);

      fs.unlinkSync(specialFile);
    });
  });

  describe('Security: Real-world Attack Scenarios', () => {
    it('should block attempt to read /etc/passwd', () => {
      const attacks = [
        '../../../../etc/passwd',
        '../../../etc/passwd.yaml',
        '/etc/passwd',
        'config/../../etc/passwd',
      ];

      attacks.forEach(attack => {
        const result = validateFilePath(attack, ['.yaml', '.yml']);
        expect(result.valid).toBe(false);
      });
    });

    it('should block attempt to read SSH private keys', () => {
      const attacks = [
        '../../../root/.ssh/id_rsa',
        '~/../../root/.ssh/id_rsa.yaml',
      ];

      attacks.forEach(attack => {
        const result = validateFilePath(attack, ['.yaml', '.yml']);
        expect(result.valid).toBe(false);
      });
    });

    it('should block attempt to read environment files', () => {
      const attacks = [
        '../../../.env',
        'config/../../../.env.yaml',
      ];

      attacks.forEach(attack => {
        const result = validateFilePath(attack, ['.yaml', '.yml']);
        expect(result.valid).toBe(false);
      });
    });

    it('should block Windows system file access attempts', () => {
      const attacks = [
        '..\\..\\..\\windows\\system32\\config\\sam',
        'C:\\Windows\\System32\\config\\SAM.yaml',
      ];

      attacks.forEach(attack => {
        const result = validateFilePath(attack, ['.yaml', '.yml']);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should validate paths quickly (< 100ms for 1000 validations)', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        validateFilePath(tempYamlFile, ['.yaml', '.yml']);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});
