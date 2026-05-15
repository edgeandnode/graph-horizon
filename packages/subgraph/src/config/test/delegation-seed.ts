// Test seed data for delegation unit testing
// Individual delegators/delegations are lazy-initialized, not seeded at genesis

// Indexer addresses with delegations (for DelegationPool seeding)
export const DELEGATED_INDEXER_ADDRESSES: string[] = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
]

// Legacy indexing reward cuts in PPM (parallel array, same order as DELEGATED_INDEXER_ADDRESSES)
// Used to calculate delegation rewards from legacy allocations
export const LEGACY_INDEXER_REWARD_CUTS: i32[] = [
  823076, // 82.3076% to indexer, 17.6924% to delegators
  823076,
]
