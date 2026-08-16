import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

test('every frontend route opts into the fixed viewport policy', () => {
  const htmlFiles = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.html')) htmlFiles.push(file);
    }
  };
  walk(path.resolve(root, '..'));
  assert.ok(htmlFiles.length > 0);
  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /\.\.\/shared\/viewport\.css/, path.relative(root, file));
  }
});

test('viewport policy forbids vertical overflow while preserving horizontal rails', () => {
  const source = fs.readFileSync(path.join(root, 'viewport.css'), 'utf8');
  assert.match(source, /overflow:\s*hidden\s*!important/);
  assert.match(source, /overflow-y:\s*hidden\s*!important/);
  assert.match(source, /overflow-x:\s*auto\s*!important/);
  assert.match(source, /overscroll-behavior:\s*none/);
});
