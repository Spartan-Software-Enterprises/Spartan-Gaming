const SYSTEM_CORE_PREFERENCE = Object.freeze({
  nes: ['libretro'],
  snes: ['libretro'],
  gba: ['libretro'],
  'game-boy': ['sameboy', 'libretro'],
  'game-boy-color': ['sameboy', 'libretro'],
  'nintendo-64': ['libretro'],
  'playstation-1': ['duckstation', 'libretro'],
  'playstation-2': ['pcsx2'],
  'playstation-3': ['rpcs3'],
  psp: ['ppsspp'],
  gamecube: ['dolphin'],
  wii: ['dolphin'],
  'wii-u': ['cemu'],
  'playstation-vita': ['vita3k'],
  'nintendo-ds': ['melonds'],
  'nintendo-3ds': ['azahar'],
  arcade: ['mame'],
  dreamcast: ['flycast'],
  naomi: ['flycast'],
  atomiswave: ['flycast'],
  'original-xbox': ['xemu'],
  'adventure-engines': ['scummvm'],
  dos: ['dosbox-staging'],
  flash: ['ruffle'],
  'web-games': ['ruffle'],
  'multi-system': ['libretro'],
});

export function resolveEmulatorCoreForRom(rom, cores = []) {
  const candidates = SYSTEM_CORE_PREFERENCE[rom?.system] || SYSTEM_CORE_PREFERENCE['multi-system'];
  return (
    candidates.map((id) => cores.find((core) => core.id === id)).find((core) => core) ||
    cores.find((core) => core.id === 'libretro') ||
    null
  );
}

export function corePreferences() {
  return SYSTEM_CORE_PREFERENCE;
}
