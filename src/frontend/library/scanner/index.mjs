export { isRomFile, ROM_EXTENSIONS };

const ROM_EXTENSIONS = new Set([
  'nes',
  'smc',
  'sfc',
  'sf',
  'gb',
  'gbc',
  'gba',
  'n64',
  'z64',
  'v64',
  'iso',
  'bin',
  'cue',
  'chd',
  'gdi',
  'wbfs',
  'rvz',
  'wad',
  'cia',
  '3ds',
  'nds',
  'dsi',
  'xiso',
  'rom',
  'img',
  'zip',
  '7z',
  'gz',
]);

function isRomFile(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return ROM_EXTENSIONS.has(ext);
}

export async function scanDirectory(paths, options = {}) {
  const { signal, onProgress, onFile } = options;
  const results = { scanned: 0, added: 0, updated: 0, errors: [] };

  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API not supported');
  }

  const dirHandles = Array.isArray(paths) ? paths : [paths];

  for (const dirHandle of dirHandles) {
    await _scanDirectoryRecursive(dirHandle, {
      signal,
      onProgress: (current, total) => {
        results.scanned = current;
        onProgress?.(current, total);
      },
      onFile: async (file) => {
        results.added++;
        await onFile?.(file);
      },
    });
  }

  return results;
}

async function _scanDirectoryRecursive(dirHandle, options) {
  const { signal, onProgress, onFile } = options;
  let current = 0;
  let total = 0;

  const queue = [{ handle: dirHandle, path: '' }];

  while (queue.length > 0) {
    if (signal?.aborted) throw new Error('Scan aborted');

    const { handle, path } = queue.shift();

    for await (const [name, entry] of handle.entries()) {
      if (signal?.aborted) throw new Error('Scan aborted');

      if (entry.kind === 'file' && isRomFile(name)) {
        total++;
        current++;
        onProgress?.(current, total);

        try {
          const file = await entry.getFile();
          const fileWithPath = Object.assign(file, { path: fullPath, dirHandle: handle });
          await onFile(fileWithPath);
        } catch (error) {
          console.warn('Failed to process ' + fullPath + ':', error);
        }
      } else if (entry.kind === 'directory') {
        queue.push({ handle: entry, path: fullPath });
      }
    }
  }
}

export async function watchDirectory(dirHandle, options = {}) {
  const { onChange, onError, signal } = options;

  if (!dirHandle) {
    throw new Error('Directory handle required');
  }

  let polling = true;
  let lastFiles = new Map();

  const poll = async () => {
    while (polling && !signal?.aborted) {
      try {
        const currentFiles = new Map();

        for await (const [name, entry] of dirHandle.entries()) {
          if (entry.kind === 'file' && isRomFile(name)) {
            const file = await entry.getFile();
            currentFiles.set(name, {
              name,
              size: file.size,
              lastModified: file.lastModified,
              path: name,
            });
          }
        }

        for (const [name, file] of currentFiles) {
          const previous = lastFiles.get(name);
          if (!previous) {
            onChange?.({ type: 'add', file });
          } else if (previous.size !== file.size || previous.lastModified !== file.lastModified) {
            onChange?.({ type: 'change', file, previous });
          }
        }

        for (const [name, file] of lastFiles) {
          if (!currentFiles.has(name)) {
            onChange?.({ type: 'remove', file });
          }
        }

        lastFiles = currentFiles;
      } catch (error) {
        onError?.(error);
      }

      await new Promise((r) => setTimeout(r, options.pollInterval ?? 30000));
    }
  };

  poll();

  return {
    stop() {
      polling = false;
    },
  };
}

export async function pickLibraryDirectory() {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API not supported');
  }
  return window.showDirectoryPicker({ mode: 'read' });
}

export async function getFileHash(file, algorithm = 'SHA-256') {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
