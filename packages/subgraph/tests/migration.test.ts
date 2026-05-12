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
import { encodeGetStake } from "../src/common/multicall"

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
      []  // empty delegated indexer addresses
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
