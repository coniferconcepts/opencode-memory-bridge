import { describe, it, expect } from 'bun:test';
import { scrubSensitive } from '../algorithms/scrubber';

describe('sensitive data scrubbing', () => {
  it('redacts sensitive patterns', () => {
    const jwt = `eyJ${'a'.repeat(120)}`;
    const input = [
      'stripe key sk-abcdefghijklmnopqrstuv',
      'Bearer ABCDEFGHIJKLMNOPQRST',
      `jwt ${jwt}`,
      'hex 0123456789abcdef0123456789abcdef',
      'email test.user@example.com',
      'ssn 123-45-6789',
      'phone 555-555-1234',
    ].join(' | ');

    const output = scrubSensitive(input);

    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('sk-abcdefghijklmnopqrstuv');
    expect(output).not.toContain('Bearer ABCDEFGHIJKLMNOPQRST');
    expect(output).not.toContain(jwt);
    expect(output).not.toContain('0123456789abcdef0123456789abcdef');
    expect(output).not.toContain('test.user@example.com');
    expect(output).not.toContain('123-45-6789');
    expect(output).not.toContain('555-555-1234');
  });

  it('returns original text when no patterns are present', () => {
    const input = 'no secrets here';
    expect(scrubSensitive(input)).toBe(input);
  });
});