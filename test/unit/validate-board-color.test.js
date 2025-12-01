/**
 * Unit tests for board.js color validation
 * Tests CSS injection prevention via validateHexColor function
 */

import { describe, it, expect } from 'vitest';

/**
 * Copy of validateHexColor function from public/js/board.js for testing
 * Note: Cannot import directly from board.js due to Vue dependencies
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
    // Only accept standard hex color formats to prevent CSS injection attacks
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

describe('board.js validateHexColor (CSS Injection Prevention)', () => {
  describe('Valid color formats', () => {
    it('should accept valid 6-digit hex color (#rrggbb)', () => {
      const result = validateHexColor('#ff55ff');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });

    it('should accept valid 3-digit hex color (#rgb)', () => {
      const result = validateHexColor('#f5f');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff'); // expanded to #rrggbb
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

    it('should normalize uppercase to lowercase', () => {
      const result = validateHexColor('#FF55FF');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });

    it('should trim whitespace', () => {
      const result = validateHexColor('  #ff55ff  ');
      expect(result.valid).toBe(true);
      expect(result.normalizedColor).toBe('#ff55ff');
    });
  });

  describe('CSS Injection Prevention', () => {
    it('should reject CSS injection with background-image', () => {
      const maliciousColor = "red !important; background-image: url('http://evil.com/phishing.png')";
      const result = validateHexColor(maliciousColor);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with opacity', () => {
      const maliciousColor = "transparent; opacity: 0; display: none";
      const result = validateHexColor(maliciousColor);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with position', () => {
      const maliciousColor = "#ff55ff; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999";
      const result = validateHexColor(maliciousColor);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with !important', () => {
      const result = validateHexColor('#ff55ff !important');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with semicolon', () => {
      const result = validateHexColor('#ff55ff; display: none');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with url()', () => {
      const result = validateHexColor("url('javascript:alert(1)')");
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with expression()', () => {
      const result = validateHexColor("expression(alert('xss'))");
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with rgba()', () => {
      const result = validateHexColor('rgba(255, 0, 0, 0.5)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with rgb()', () => {
      const result = validateHexColor('rgb(255, 0, 0)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject CSS injection with hsl()', () => {
      const result = validateHexColor('hsl(120, 100%, 50%)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
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

  describe('Named colors (should be rejected)', () => {
    it('should reject named color "red"', () => {
      const result = validateHexColor('red');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject named color "blue"', () => {
      const result = validateHexColor('blue');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject named color "transparent"', () => {
      const result = validateHexColor('transparent');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject named color "inherit"', () => {
      const result = validateHexColor('inherit');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject named color "initial"', () => {
      const result = validateHexColor('initial');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should reject named color "unset"', () => {
      const result = validateHexColor('unset');
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
