const RUNTIME_PREFERENCE = Object.freeze({automatic: 'automatic', 'spartan-runtime': 'browser-wasm', 'libretro-host': 'libretro-core', 'native-adapter': 'native-adapter'});
const CORE_PRESETS = Object.freeze({
  libretro: {controllerProfile: 'Auto-detect', renderer: 'WebGPU when available', features: ['save-state', 'shaders', 'integer-scaling', 'netplay-candidate'], notes: ['Core-specific license and redistribution terms must be honored.']},
  retroarch: {controllerProfile: 'Auto-detect', renderer: 'Vulkan/Metal/DirectX through native adapter', features: ['save-state', 'shaders', 'rewind', 'netplay'], notes: ['RetroArch is a native reference adapter; Spartan Gaming does not embed its UI.']},
  dolphin: {controllerProfile: 'Nintendo layout', renderer: 'Vulkan/Metal/DirectX', features: ['save-state', 'shaders', 'netplay-candidate', 'rumble'], notes: ['Wii/GameCube services and keys remain user-provided and platform-specific.']},
  pcsx2: {controllerProfile: 'PlayStation layout', renderer: 'Vulkan/DirectX/OpenGL', features: ['save-state', 'memory-card', 'shaders', 'rumble'], notes: ['A legally dumped PS2 BIOS may be required.']},
  rpcs3: {controllerProfile: 'PlayStation layout', renderer: 'Vulkan/DirectX', features: ['save-state', 'shader-cache', 'rumble'], notes: ['Firmware, keys, and game data must be supplied legally by the user.']},
  ppsspp: {controllerProfile: 'PlayStation layout', renderer: 'Vulkan/Metal/DirectX/WebGPU candidate', features: ['save-state', 'texture-scaling', 'shaders', 'netplay-candidate', 'rumble'], notes: ['Native and browser paths may have different performance and feature coverage.']},
  melonds: {controllerProfile: 'Nintendo layout', renderer: 'OpenGL/WebGPU candidate', features: ['save-state', 'integer-scaling', 'touch-screen'], notes: ['Dual-screen and touch input require an explicit layout.']},
  azahar: {controllerProfile: 'Nintendo layout', renderer: 'Vulkan/OpenGL', features: ['save-state', 'shader-cache', 'touch-screen'], notes: ['Native adapter and platform compatibility review required.']},
  mame: {controllerProfile: 'Arcade layout', renderer: 'OpenGL/WebGPU candidate', features: ['save-state', 'shaders', 'integer-scaling', 'netplay-candidate'], notes: ['Arcade set versions and per-machine files must match the selected core.']},
  flycast: {controllerProfile: 'Xbox layout', renderer: 'Vulkan/OpenGL/WebGPU candidate', features: ['save-state', 'shaders', 'netplay-candidate', 'rumble'], notes: []},
  xemu: {controllerProfile: 'Xbox layout', renderer: 'Vulkan/DirectX', features: ['save-state', 'shader-cache', 'rumble'], notes: ['Xbox MCPX/BIOS and game data are user responsibilities.']},
  scummvm: {controllerProfile: 'Keyboard and mouse', renderer: 'WebGPU/Canvas', features: ['save-state', 'scaling', 'touch-controls'], notes: ['Only user-selected game data is mounted into the runtime.']},
});

function runtimeFor(core, preference) {
  if (preference && preference !== RUNTIME_PREFERENCE.automatic) return preference;
  if (core.id === 'libretro') return 'libretro-core';
  if (core.mode === 'browser-or-native' || core.mode === 'browser-or-native') return 'browser-wasm';
  if (core.mode === 'native-or-wasm-candidate') return 'native-adapter';
  return 'native-adapter';
}

export function createEmulatorIntegration(core, {preference = 'automatic', renderer = 'Automatic', report = {}} = {}) {
  if (!core?.id || !core.mode) throw new TypeError('A normalized emulator core is required');
  const preset = CORE_PRESETS[core.id] || {controllerProfile: 'Auto-detect', renderer: 'Automatic', features: ['save-state'], notes: []};
  const runtime = runtimeFor(core, RUNTIME_PREFERENCE[preference] || preference);
  const browserReady = runtime === 'browser-wasm' && (report.graphics?.webgpuAdapter === true || report.graphics?.webgl === true || report.graphics === undefined);
  const selectedRenderer = renderer === 'Automatic' ? preset.renderer : renderer;
  const firmwareRequired = ['pcsx2', 'rpcs3', 'xemu'].includes(core.id);
  return Object.freeze({coreId: core.id, runtime, renderer: selectedRenderer, controllerProfile: preset.controllerProfile, features: Object.freeze([...preset.features]), browserReady, content: Object.freeze({gameFiles: true, firmwareFiles: firmwareRequired, userSelectedOnly: true, licenseRequired: true}), notes: Object.freeze([...preset.notes, ...(runtime === 'browser-wasm' && !browserReady ? ['Browser graphics capability is not confirmed; native adapter fallback is recommended.'] : [])])});
}

export function emulatorTroubleshooting(integration) {
  const issues = [];
  if (integration.content.firmwareFiles) issues.push({severity: 'info', key: 'firmware', message: 'Select legally dumped firmware before preparing this launch.'});
  if (integration.runtime === 'native-adapter') issues.push({severity: 'info', key: 'native-adapter', message: 'A signed native adapter is required for this runtime path.'});
  if (!integration.browserReady && integration.runtime === 'browser-wasm') issues.push({severity: 'warning', key: 'graphics', message: 'WebGPU/WebGL readiness is not confirmed for the browser runtime.'});
  return Object.freeze(issues.map(issue => Object.freeze(issue)));
}
