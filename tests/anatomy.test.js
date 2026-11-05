import { describe, it, expect } from 'vitest';
import { ANATOMY } from '../src/data/anatomy';

describe('Anatomy Data', () => {
  it('has no empty fields and each field is within 220 characters', () => {
    const fields = ['does', 'made', 'fails', 'notice', 'life'];
    
    Object.entries(ANATOMY).forEach(([part, data]) => {
      fields.forEach(field => {
        const content = data[field];
        
        // Check not empty
        expect(content, `Part "${part}" field "${field}" should not be empty`).toBeTruthy();
        expect(content.length, `Part "${part}" field "${field}" should not be empty`).toBeGreaterThan(0);
        
        // Check length
        expect(content.length, `Part "${part}" field "${field}" is too long (${content.length} > 220)`).toBeLessThanOrEqual(220);
      });
      
      // Check links (optional but good practice)
      expect(Array.isArray(data.links), `Part "${part}" links should be an array`).toBe(true);
      data.links.forEach(link => {
        expect(typeof link, `Part "${part}" link "${link}" should be a string`).toBe('string');
      });
    });
  });
});
