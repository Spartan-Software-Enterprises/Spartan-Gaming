const CATEGORY_RULES = Object.freeze([
  Object.freeze({ id: 'cloud', label: 'Cloud gaming', kinds: ['cloud-gaming', 'cloud-pc'] }),
  Object.freeze({ id: 'remote', label: 'Remote play', kinds: ['remote-play'] }),
  Object.freeze({
    id: 'streaming',
    label: 'Live streaming',
    kinds: ['live-streaming', 'social-streaming', 'self-hosted-live-streaming'],
  }),
  Object.freeze({ id: 'libraries', label: 'Game libraries', kinds: ['game-library', 'native'] }),
]);

export const PROVIDER_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'all', label: 'All providers' }),
  ...CATEGORY_RULES,
]);

export function providerCategory(provider) {
  const rule = CATEGORY_RULES.find((candidate) => candidate.kinds.includes(provider?.kind));
  return rule?.id || 'libraries';
}

export function providersForCategory(providers, category = 'all') {
  if (category === 'all') return [...providers];
  return providers.filter((provider) => providerCategory(provider) === category);
}

export function providerCategoryCounts(providers) {
  return Object.fromEntries(
    PROVIDER_CATEGORIES.map((category) => [
      category.id,
      category.id === 'all'
        ? providers.length
        : providers.filter((provider) => providerCategory(provider) === category.id).length,
    ]),
  );
}
