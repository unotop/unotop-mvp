import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

describe('FS write smoke', () => {
  it('writes and reads audit.json marker', () => {
    const p = join(process.cwd(), 'audit.json');
    writeFileSync(p, JSON.stringify({ marker: 'ok' }), 'utf8');
    const txt = readFileSync(p, 'utf8');
    expect(txt).toContain('marker');
  });
});
