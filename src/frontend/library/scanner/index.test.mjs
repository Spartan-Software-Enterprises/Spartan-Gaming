import { isRomFile, ROM_EXTENSIONS } from './index.mjs';

describe('ROM file detection', () => {
  it('identifies common ROM extensions', () => {
    expect(isRomFile('game.nes')).toBe(true);
    expect(isRomFile('game.smc')).toBe(true);
    expect(isRomFile('game.gba')).toBe(true);
    expect(isRomFile('game.n64')).toBe(true);
    expect(isRomFile('game.iso')).toBe(true);
    expect(isRomFile('game.gdi')).toBe(true);
    expect(isRomFile('game.wbfs')).toBe(true);
    expect(isRomFile('game.cia')).toBe(true);
    expect(isRomFile('game.nds')).toBe(true);
    expect(isRomFile('game.3ds')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isRomFile('GAME.NES')).toBe(true);
    expect(isRomFile('Game.Smc')).toBe(true);
  });

  it('rejects non-ROM files', () => {
    expect(isRomFile('readme.txt')).toBe(false);
    expect(isRomFile('image.png')).toBe(false);
    expect(isRomFile('document.pdf')).toBe(false);
    expect(isRomFile('archive.zip')).toBe(true);
    expect(isRomFile('game')).toBe(false);
  });

  it('includes archive formats', () => {
    expect(ROM_EXTENSIONS.has('zip')).toBe(true);
    expect(ROM_EXTENSIONS.has('7z')).toBe(true);
    expect(ROM_EXTENSIONS.has('gz')).toBe(true);
  });
});

describe('ROM_EXTENSIONS set', () => {
  it('contains expected platforms', () => {
    const platforms = {
      nintendo: [
        'nes',
        'smc',
        'sfc',
        'gb',
        'gbc',
        'gba',
        'n64',
        'z64',
        'v64',
        'cia',
        '3ds',
        'nds',
        'dsi',
      ],
      sony: ['iso', 'bin', 'cue', 'chd', 'gdi'],
      sega: [],
      microsoft: ['xiso'],
      arcade: ['chd'],
      archives: ['zip', '7z', 'gz'],
    };

    for (const [_, extensions] of Object.entries(platforms)) {
      for (const ext of extensions) {
        expect(ROM_EXTENSIONS.has(ext)).toBe(true);
      }
    }
  });
});
