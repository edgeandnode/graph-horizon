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
import { migrateServiceProviders } from "../src/handlers/migration"
import { GRAPH_NETWORK_ID } from "../src/common/constants"
import { testConfig, NetworkConfig } from "../src/config"

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

// Helper to mock getStake for test addresses
function mockGetStake(address: Address, stake: BigInt): void {
  createMockedFunction(testConfig.horizonStakingAddress, "getStake", "getStake(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(address)])
    .returns([ethereum.Value.fromUnsignedBigInt(stake)])
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

    mockGetStake(Address.fromString("0x1111111111111111111111111111111111111111"), stake1)
    mockGetStake(Address.fromString("0x2222222222222222222222222222222222222222"), stake2)
    mockGetStake(Address.fromString("0x3333333333333333333333333333333333333333"), stake3)

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
    mockGetStake(Address.fromString("0x1111111111111111111111111111111111111111"), BigInt.fromI32(0))
    mockGetStake(Address.fromString("0x2222222222222222222222222222222222222222"), BigInt.fromI32(0))
    mockGetStake(Address.fromString("0x3333333333333333333333333333333333333333"), BigInt.fromI32(0))

    let block = createMockBlock(100, 1000)
    migrateServiceProviders(block, testConfig)

    assert.entityCount("ServiceProvider", 3)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "3")
  })

  test("sets correct block metadata on ServiceProviders", () => {
    mockGetStake(Address.fromString("0x1111111111111111111111111111111111111111"), BigInt.fromI32(100))
    mockGetStake(Address.fromString("0x2222222222222222222222222222222222222222"), BigInt.fromI32(100))
    mockGetStake(Address.fromString("0x3333333333333333333333333333333333333333"), BigInt.fromI32(100))

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
      1,
      [] // empty addresses
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
