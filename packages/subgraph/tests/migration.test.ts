import {
  describe,
  test,
  beforeEach,
  afterEach,
  clearStore,
  assert,
  createMockedFunction,
} from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { migrateServiceProviders, migrateDelegationPools } from "../src/handlers/migration"
import { GRAPH_NETWORK_ID } from "../src/common/constants"
import { testConfig, NetworkConfig } from "../src/config"
import { encodeGetStake, encodeGetDelegationPool } from "../src/common/multicall"

// Helper to create a mock block
function createMockBlock(number: i32, timestamp: i32): ethereum.Block {
  return new ethereum.Block(
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"),
    Address.zero(),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"),
    BigInt.fromI32(number),
    BigInt.fromI32(0),
    BigInt.fromI32(0),
    BigInt.fromI32(timestamp),
    BigInt.fromI32(0),
    BigInt.fromI32(0),
    BigInt.fromI32(0),
    BigInt.fromI32(0)
  )
}

// Helper to encode a uint256 result for multicall
function encodeUint256Result(value: BigInt): Bytes {
  let encoded = ethereum.encode(ethereum.Value.fromUnsignedBigInt(value))!
  return Bytes.fromUint8Array(encoded)
}

// Helper to mock multicall for getStake calls
function mockMulticallGetStakes(addresses: Address[], stakes: BigInt[]): void {
  // Build the expected calls array
  let calls: Bytes[] = []
  for (let i = 0; i < addresses.length; i++) {
    calls.push(encodeGetStake(addresses[i]))
  }

  // Build the expected results array
  let results: Bytes[] = []
  for (let i = 0; i < stakes.length; i++) {
    results.push(encodeUint256Result(stakes[i]))
  }

  createMockedFunction(testConfig.horizonStakingAddress, "multicall", "multicall(bytes[]):(bytes[])")
    .withArgs([ethereum.Value.fromBytesArray(calls)])
    .returns([ethereum.Value.fromBytesArray(results)])
}

// Helper to encode a getDelegationPool result (tokens, shares, tokensThawing, sharesThawing, thawingNonce)
function encodeDelegationPoolResult(
  tokens: BigInt,
  shares: BigInt,
  tokensThawing: BigInt,
  sharesThawing: BigInt = BigInt.zero(),
  thawingNonce: BigInt = BigInt.zero()
): Bytes {
  let tuple = new ethereum.Tuple()
  tuple.push(ethereum.Value.fromUnsignedBigInt(tokens))
  tuple.push(ethereum.Value.fromUnsignedBigInt(shares))
  tuple.push(ethereum.Value.fromUnsignedBigInt(tokensThawing))
  tuple.push(ethereum.Value.fromUnsignedBigInt(sharesThawing))
  tuple.push(ethereum.Value.fromUnsignedBigInt(thawingNonce))
  let encoded = ethereum.encode(ethereum.Value.fromTuple(tuple))!
  return Bytes.fromUint8Array(encoded)
}

// Helper to mock multicall for getDelegationPool calls
function mockMulticallGetDelegationPools(
  indexers: Address[],
  verifier: Address,
  poolData: BigInt[][] // Each entry is [tokens, shares, tokensThawing]
): void {
  let calls: Bytes[] = []
  for (let i = 0; i < indexers.length; i++) {
    calls.push(encodeGetDelegationPool(indexers[i], verifier))
  }

  let results: Bytes[] = []
  for (let i = 0; i < poolData.length; i++) {
    results.push(encodeDelegationPoolResult(poolData[i][0], poolData[i][1], poolData[i][2]))
  }

  createMockedFunction(testConfig.horizonStakingAddress, "multicall", "multicall(bytes[]):(bytes[])")
    .withArgs([ethereum.Value.fromBytesArray(calls)])
    .returns([ethereum.Value.fromBytesArray(results)])
}

// Helper to get delegation pool ID (serviceProvider + verifier)
function getDelegationPoolId(serviceProvider: Address, verifier: Address): string {
  return Bytes.fromHexString(serviceProvider.toHexString()).concat(
    Bytes.fromHexString(verifier.toHexString())
  ).toHexString()
}

describe("migrateServiceProviders", () => {
  beforeEach(() => {
    clearStore()
  })

  afterEach(() => {
    clearStore()
  })

  test("creates ServiceProvider entities for each address in config", () => {
    // Setup: mock stakes for test addresses
    // Test config has 3 addresses: 0x111..., 0x222..., 0x333...
    let stake1 = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let stake2 = BigInt.fromString("2000000000000000000000") // 2000 GRT
    let stake3 = BigInt.fromString("3000000000000000000000") // 3000 GRT
    let totalStake = stake1.plus(stake2).plus(stake3)

    let addresses = [
      Address.fromString("0x1111111111111111111111111111111111111111"),
      Address.fromString("0x2222222222222222222222222222222222222222"),
      Address.fromString("0x3333333333333333333333333333333333333333"),
    ]
    let stakes = [stake1, stake2, stake3]
    mockMulticallGetStakes(addresses, stakes)

    // Execute
    let block = createMockBlock(100, 1000)
    migrateServiceProviders(block, testConfig)

    // Assert: GraphNetwork
    assert.entityCount("GraphNetwork", 1)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "3")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", totalStake.toString())

    // Assert: ServiceProviders
    assert.entityCount("ServiceProvider", 3)

    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "tokensStaked", stake1.toString())
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "createdAtBlock", "100")
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "createdAt", "1000")

    assert.fieldEquals("ServiceProvider", "0x2222222222222222222222222222222222222222", "tokensStaked", stake2.toString())
    assert.fieldEquals("ServiceProvider", "0x3333333333333333333333333333333333333333", "tokensStaked", stake3.toString())
  })

  test("handles zero stake correctly", () => {
    let addresses = [
      Address.fromString("0x1111111111111111111111111111111111111111"),
      Address.fromString("0x2222222222222222222222222222222222222222"),
      Address.fromString("0x3333333333333333333333333333333333333333"),
    ]
    let stakes = [BigInt.fromI32(0), BigInt.fromI32(0), BigInt.fromI32(0)]
    mockMulticallGetStakes(addresses, stakes)

    let block = createMockBlock(100, 1000)
    migrateServiceProviders(block, testConfig)

    assert.entityCount("ServiceProvider", 3)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "3")
  })

  test("sets correct block metadata on ServiceProviders", () => {
    let addresses = [
      Address.fromString("0x1111111111111111111111111111111111111111"),
      Address.fromString("0x2222222222222222222222222222222222222222"),
      Address.fromString("0x3333333333333333333333333333333333333333"),
    ]
    let stakes = [BigInt.fromI32(100), BigInt.fromI32(100), BigInt.fromI32(100)]
    mockMulticallGetStakes(addresses, stakes)

    let block = createMockBlock(408825706, 1700000000)
    migrateServiceProviders(block, testConfig)

    // All SPs should have the same block metadata (genesis block)
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "createdAtBlock", "408825706")
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "createdAt", "1700000000")
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "updatedAtBlock", "408825706")
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "updatedAt", "1700000000")
  })
})

describe("migrateServiceProviders with empty config", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates only GraphNetwork when no addresses configured", () => {
    // Create an empty config
    let emptyConfig = new NetworkConfig(
      "test-empty",
      testConfig.horizonStakingAddress,
      testConfig.subgraphServiceAddress,
      1,
      [], // empty service provider addresses
      [],  // empty delegated indexer addresses
      []   // empty legacy indexer reward cuts
    )

    let block = createMockBlock(100, 1000)
    migrateServiceProviders(block, emptyConfig)

    // GraphNetwork should exist but with zero values
    assert.entityCount("GraphNetwork", 1)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", "0")

    // No ServiceProviders
    assert.entityCount("ServiceProvider", 0)
  })
})

describe("migrateDelegationPools", () => {
  beforeEach(() => {
    clearStore()
  })

  afterEach(() => {
    clearStore()
  })

  test("creates DelegationPool entities with correct values", () => {
    // Test config has 2 delegated indexers: 0x111..., 0x222...
    let indexer1 = Address.fromString("0x1111111111111111111111111111111111111111")
    let indexer2 = Address.fromString("0x2222222222222222222222222222222222222222")
    let verifier = testConfig.subgraphServiceAddress

    let pool1Tokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let pool1Shares = BigInt.fromString("4500000000000000000000") // 4500 shares
    let pool1Thawing = BigInt.fromString("100000000000000000000") // 100 GRT thawing

    let pool2Tokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let pool2Shares = BigInt.fromString("9000000000000000000000") // 9000 shares
    let pool2Thawing = BigInt.zero()

    let totalDelegated = pool1Tokens.plus(pool2Tokens)

    mockMulticallGetDelegationPools(
      [indexer1, indexer2],
      verifier,
      [
        [pool1Tokens, pool1Shares, pool1Thawing],
        [pool2Tokens, pool2Shares, pool2Thawing],
      ]
    )

    let block = createMockBlock(100, 1000)
    migrateDelegationPools(block, testConfig)

    // Assert: DelegationPools created
    assert.entityCount("DelegationPool", 2)

    let pool1Id = getDelegationPoolId(indexer1, verifier)
    assert.fieldEquals("DelegationPool", pool1Id, "tokens", pool1Tokens.toString())
    assert.fieldEquals("DelegationPool", pool1Id, "shares", pool1Shares.toString())
    assert.fieldEquals("DelegationPool", pool1Id, "tokensThawing", pool1Thawing.toString())

    let pool2Id = getDelegationPoolId(indexer2, verifier)
    assert.fieldEquals("DelegationPool", pool2Id, "tokens", pool2Tokens.toString())
    assert.fieldEquals("DelegationPool", pool2Id, "shares", pool2Shares.toString())
    assert.fieldEquals("DelegationPool", pool2Id, "tokensThawing", pool2Thawing.toString())

    // Assert: GraphNetwork updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countDelegationPools", "2")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", totalDelegated.toString())
  })

  test("sets legacyIndexingRewardCut from config", () => {
    let indexer1 = Address.fromString("0x1111111111111111111111111111111111111111")
    let indexer2 = Address.fromString("0x2222222222222222222222222222222222222222")
    let verifier = testConfig.subgraphServiceAddress

    mockMulticallGetDelegationPools(
      [indexer1, indexer2],
      verifier,
      [
        [BigInt.fromI32(1000), BigInt.fromI32(1000), BigInt.zero()],
        [BigInt.fromI32(2000), BigInt.fromI32(2000), BigInt.zero()],
      ]
    )

    let block = createMockBlock(100, 1000)
    migrateDelegationPools(block, testConfig)

    // Test config has reward cuts: [823076, 823076]
    let pool1Id = getDelegationPoolId(indexer1, verifier)
    let pool2Id = getDelegationPoolId(indexer2, verifier)

    assert.fieldEquals("DelegationPool", pool1Id, "legacyIndexingRewardCut", "823076")
    assert.fieldEquals("DelegationPool", pool2Id, "legacyIndexingRewardCut", "823076")
  })

  test("updates ServiceProvider tokensDelegated", () => {
    let indexer1 = Address.fromString("0x1111111111111111111111111111111111111111")
    let indexer2 = Address.fromString("0x2222222222222222222222222222222222222222")
    let verifier = testConfig.subgraphServiceAddress

    let pool1Tokens = BigInt.fromString("5000000000000000000000")
    let pool2Tokens = BigInt.fromString("10000000000000000000000")

    mockMulticallGetDelegationPools(
      [indexer1, indexer2],
      verifier,
      [
        [pool1Tokens, BigInt.fromI32(1000), BigInt.zero()],
        [pool2Tokens, BigInt.fromI32(2000), BigInt.zero()],
      ]
    )

    let block = createMockBlock(100, 1000)
    migrateDelegationPools(block, testConfig)

    // ServiceProviders should be created with tokensDelegated set
    assert.fieldEquals("ServiceProvider", "0x1111111111111111111111111111111111111111", "tokensDelegated", pool1Tokens.toString())
    assert.fieldEquals("ServiceProvider", "0x2222222222222222222222222222222222222222", "tokensDelegated", pool2Tokens.toString())
  })

  test("handles empty config", () => {
    let emptyConfig = new NetworkConfig(
      "test-empty",
      testConfig.horizonStakingAddress,
      testConfig.subgraphServiceAddress,
      1,
      [],
      [], // empty delegated indexer addresses
      []  // empty legacy indexer reward cuts
    )

    let block = createMockBlock(100, 1000)
    migrateDelegationPools(block, emptyConfig)

    // No DelegationPools should be created
    assert.entityCount("DelegationPool", 0)
  })
})
