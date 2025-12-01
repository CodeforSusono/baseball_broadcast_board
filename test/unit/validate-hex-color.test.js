/**
 * Unit tests for validateHexColor function
 * Tests color validation to prevent injection of non-color strings
 */

import { describe, it, expect } from 'vitest';

/**
 * Copy of validateHexColor function from main.js for testing
 * Note: Cannot import directly from main.js due to Electron dependencies (ipcMain, etc.)
 */
function validateHexColor(color) {
  try {
    // Check if color is a non-empty string
    if (typeof color !== 'string' || color.trim() === '') {
      return { valid: false, error: 'Color must be a non-empty string' };
    }

    // Normalize: trim whitespace and convert to lowercase
    const normalizedColor = color.trim().toLowerCase();

    // SECURITY: Check for hex color code format (#rrggbb or #rgb)
    // Only accept standard hex color formats to prevent injection attacks
    const hexColorPattern = /^#([0-9a-f]{6}|[0-9a-f]{3})$/;

    if (!hexColorPattern.test(normalizedColor)) {
      return {
        valid: false,
        error: 'Color must be in hex format (#rrggbb or #rgb). Example: #ff55ff'
      };
    }

    // Expand 3-digit hex to 6-digit for consistency (#rgb -> #rrggbb)
    let expandedColor = normalizedColor;
    if (normalizedColor.length === 4) {
      // #rgb -> #rrggbb
      const r = normalizedColor[1];
      const g = normalizedColor[2];
      const b = normalizedColor[3];
      expandedColor = `#${r}${r}${g}${g}${b}${b}`;
    }

    return { valid: true, normalizedColor: expandedColor };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

describe('validateHexColor', () => {
  describe('Valid color formats', () => {
    it('should accept valid 6-digit hex color (#rrggbb)', () => {
      const result = validateHexColor('#ff55ff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });

    it('should accept valid 6-digit hex color with uppercase', () => {
      const result = validateHexColor('#FF55FF');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff'); // normalized to lowercase
    });

    it('should accept valid 3-digit hex color (#rgb)', () => {
      const result = validateHexColor('#f5f');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff'); // expanded to #rrggbb
    });

    it('should accept valid 3-digit hex color with uppercase', () => {
      const result = validateHexColor('#F5F');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff'); // normalized and expanded
    });

    it('should accept black (#000000)', () => {
      const result = validateHexColor('#000000');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#000000');
    });

    it('should accept white (#ffffff)', () => {
      const result = validateHexColor('#ffffff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ffffff');
    });

    it('should trim whitespace and accept valid color', () => {
      const result = validateHexColor('  #ff55ff  ');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });
  });

  describe('Invalid color formats', () => {
    it('should reject color without # prefix', () => {
      const result = validateHexColor('ff55ff');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject color with invalid length (too short)', () => {
      const result = validateHexColor('#ff');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject color with invalid length (too long)', () => {
      const result = validateHexColor('#ff55ff00');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject color with invalid characters', () => {
      const result = validateHexColor('#gghhii');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject color with special characters', () => {
      const result = validateHexColor('#ff55ff;');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject empty string', () => {
      const result = validateHexColor('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject whitespace-only string', () => {
      const result = validateHexColor('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject non-string input (number)', () => {
      const result = validateHexColor(123456);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject non-string input (object)', () => {
      const result = validateHexColor({ color: '#ff55ff' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject non-string input (null)', () => {
      const result = validateHexColor(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject non-string input (undefined)', () => {
      const result = validateHexColor(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });
  });

  describe('Injection attack prevention', () => {
    it('should reject SQL injection attempt', () => {
      const result = validateHexColor("'; DROP TABLE colors; --");
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject JavaScript code injection', () => {
      const result = validateHexColor('<script>alert("xss")</script>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject command injection attempt', () => {
      const result = validateHexColor('$(rm -rf /)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject JSON injection attempt', () => {
      const result = validateHexColor('{"backgroundColor": "red"}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject newline injection attempt', () => {
      const result = validateHexColor('#ff55ff\n"malicious": "data"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject Unicode escape injection', () => {
      const result = validateHexColor('\\u0023ff55ff');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long strings', () => {
      const longString = '#' + 'f'.repeat(1000);
      const result = validateHexColor(longString);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should handle string with only hash symbol', () => {
      const result = validateHexColor('#');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should handle multiple hash symbols', () => {
      const result = validateHexColor('##ff55ff');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should handle mixed case correctly', () => {
      const result = validateHexColor('#Ff55Ff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });
  });

  describe('3-digit to 6-digit expansion', () => {
    it('should expand #abc to #aabbcc', () => {
      const result = validateHexColor('#abc');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#aabbcc');
    });

    it('should expand #123 to #112233', () => {
      const result = validateHexColor('#123');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#112233');
    });

    it('should expand #000 to #000000', () => {
      const result = validateHexColor('#000');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#000000');
    });

    it('should expand #fff to #ffffff', () => {
      const result = validateHexColor('#fff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ffffff');
    });

    it('should not expand already 6-digit colors', () => {
      const result = validateHexColor('#aabbcc');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#aabbcc'); // no expansion
    });
  });

  describe('Common color values', () => {
    it('should accept red (#ff0000)', () => {
      const result = validateHexColor('#ff0000');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff0000');
    });

    it('should accept green (#00ff00)', () => {
      const result = validateHexColor('#00ff00');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#00ff00');
    });

    it('should accept blue (#0000ff)', () => {
      const result = validateHexColor('#0000ff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#0000ff');
    });

    it('should accept magenta (#ff00ff)', () => {
      const result = validateHexColor('#ff00ff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff00ff');
    });

    it('should accept default project color (#ff55ff)', () => {
      const result = validateHexColor('#ff55ff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });
  });

  describe('Performance', () => {
    it('should validate 1000 colors in reasonable time', () => {
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        validateHexColor('#ff55ff');
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });
  });
});
