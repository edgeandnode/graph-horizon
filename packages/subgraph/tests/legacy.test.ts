import {
  describe,
  test,
  beforeEach,
  clearStore,
  assert,
  newTypedMockEvent,
} from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import {
  RebateCollected,
  AllocationClosed,
} from "../generated/HorizonStaking/HorizonStaking"
import {
  handleRebateCollected,
  handleAllocationClosed,
} from "../src/handlers/legacy"
import { GRAPH_NETWORK_ID, BIGINT_ZERO } from "../src/common/constants"
import { getDelegationPoolId } from "../src/entities/delegationPool"
import { config } from "../src/config"
import { DelegationPool, ServiceProvider, GraphNetwork, DataService } from "../generated/schema"

// Test addresses
const INDEXER_ADDRESS = Address.fromString("0x1111111111111111111111111111111111111111")
const ALLOCATION_ID = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
const ASSET_HOLDER = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
const SUBGRAPH_DEPLOYMENT_ID = Bytes.fromHexString("0x1234567890123456789012345678901234567890123456789012345678901234")

// HorizonRewardsAssigned event topic
const HORIZON_REWARDS_ASSIGNED_TOPIC = Bytes.fromHexString(
  "0xa111914d7f2ea8beca61d12f1a1f38c5533de5f1823c3936422df4404ac2ec68"
)

// Helper to set up a DataService entity
function setupDataService(verifier: Address): void {
  let id = Bytes.fromHexString(verifier.toHexString())
  let ds = new DataService(id)
  ds.countServiceProviders = 0
  ds.countProvisions = 0
  ds.countDelegationPools = 1
  ds.countProvisionSlashEvents = 0
  ds.countDelegationPoolSlashEvents = 0
  ds.tokensProvisioned = BIGINT_ZERO
  ds.tokensDelegated = BIGINT_ZERO
  ds.tokensThawingFromProvisions = BIGINT_ZERO
  ds.tokensThawingFromDelegationPools = BIGINT_ZERO
  ds.tokensSlashed = BIGINT_ZERO
  ds.tokensSlashedFromProvisions = BIGINT_ZERO
  ds.tokensSlashedFromDelegationPools = BIGINT_ZERO
  ds.createdAtBlock = BigInt.fromI32(1)
  ds.createdAt = BigInt.fromI32(100)
  ds.updatedAtBlock = BigInt.fromI32(1)
  ds.updatedAt = BigInt.fromI32(100)
  ds.save()
}

// Helper to set up a DelegationPool entity
function setupDelegationPool(
  indexer: Address,
  tokens: BigInt,
  legacyIndexingRewardCut: i32 = 823076
): void {
  let dataService = config.subgraphServiceAddress
  let poolId = getDelegationPoolId(
    Bytes.fromHexString(indexer.toHexString()),
    Bytes.fromHexString(dataService.toHexString())
  )

  let pool = new DelegationPool(poolId)
  pool.serviceProvider = Bytes.fromHexString(indexer.toHexString())
  pool.dataService = Bytes.fromHexString(dataService.toHexString())
  pool.tokens = tokens
  pool.shares = tokens // 1:1 for simplicity
  pool.tokensThawing = BigInt.zero()
  pool.legacyIndexingRewardCut = legacyIndexingRewardCut
  pool.createdAtBlock = BigInt.fromI32(1)
  pool.createdAt = BigInt.fromI32(1000)
  pool.updatedAtBlock = BigInt.fromI32(1)
  pool.updatedAt = BigInt.fromI32(1000)
  pool.save()
}

// Helper to set up a ServiceProvider entity
function setupServiceProvider(address: Address, tokensDelegated: BigInt): void {
  let sp = new ServiceProvider(Bytes.fromHexString(address.toHexString()))
  // Counts
  sp.countProvisions = 0
  sp.countProvisionSlashEvents = 0
  sp.countDelegationPoolSlashEvents = 0
  // Stake
  sp.tokensStaked = BigInt.fromI32(1000)
  sp.tokensProvisioned = BigInt.zero()
  sp.tokensIdle = BigInt.fromI32(1000)
  sp.tokensThawing = BigInt.zero()
  // Delegation
  sp.tokensDelegated = tokensDelegated
  sp.tokensDelegatedThawing = BigInt.zero()
  // Slashing
  sp.tokensSlashed = BigInt.zero()
  sp.tokensSlashedFromProvisions = BigInt.zero()
  sp.tokensSlashedFromDelegationPools = BigInt.zero()
  // Metadata
  sp.createdAtBlock = BigInt.fromI32(1)
  sp.createdAt = BigInt.fromI32(1000)
  sp.updatedAtBlock = BigInt.fromI32(1)
  sp.updatedAt = BigInt.fromI32(1000)
  sp.save()
}

// Helper to set up GraphNetwork entity
function setupGraphNetwork(tokensDelegated: BigInt): void {
  let network = new GraphNetwork(GRAPH_NETWORK_ID)
  // Counts
  network.countServiceProviders = 1
  network.countDataServices = 1
  network.countProvisions = 0
  network.countDelegationPools = 1
  network.countProvisionSlashEvents = 0
  network.countDelegationPoolSlashEvents = 0
  // Stake aggregates
  network.tokensStaked = BigInt.zero()
  network.tokensProvisioned = BigInt.zero()
  network.tokensDelegated = tokensDelegated
  network.tokensThawingFromProvisions = BigInt.zero()
  network.tokensThawingFromDelegationPools = BigInt.zero()
  // Slashing aggregates
  network.tokensSlashed = BigInt.zero()
  network.tokensSlashedFromProvisions = BigInt.zero()
  network.tokensSlashedFromDelegationPools = BigInt.zero()
  network.save()
}

// Helper to create RebateCollected event
function createRebateCollectedEvent(
  indexer: Address,
  delegationRewards: BigInt
): RebateCollected {
  let event = newTypedMockEvent<RebateCollected>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("assetHolder", ethereum.Value.fromAddress(ASSET_HOLDER)))
  event.parameters.push(new ethereum.EventParam("indexer", ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam("subgraphDeploymentID", ethereum.Value.fromBytes(SUBGRAPH_DEPLOYMENT_ID)))
  event.parameters.push(new ethereum.EventParam("allocationID", ethereum.Value.fromAddress(ALLOCATION_ID)))
  event.parameters.push(new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10000))))
  event.parameters.push(new ethereum.EventParam("protocolTax", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))))
  event.parameters.push(new ethereum.EventParam("curationFees", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))))
  event.parameters.push(new ethereum.EventParam("queryFees", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9700))))
  event.parameters.push(new ethereum.EventParam("queryRebates", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(8000))))
  event.parameters.push(new ethereum.EventParam("delegationRewards", ethereum.Value.fromUnsignedBigInt(delegationRewards)))
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)
  return event
}

describe("handleRebateCollected", () => {
  beforeEach(() => {
    clearStore()
  })

  test("updates DelegationPool tokens", () => {
    let initialPoolTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let delegationRewards = BigInt.fromString("100000000000000000000") // 100 GRT

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialPoolTokens)
    setupServiceProvider(INDEXER_ADDRESS, initialPoolTokens)
    setupGraphNetwork(initialPoolTokens)

    let event = createRebateCollectedEvent(INDEXER_ADDRESS, delegationRewards)
    handleRebateCollected(event)

    let dataService = config.subgraphServiceAddress
    let poolId = getDelegationPoolId(
      Bytes.fromHexString(INDEXER_ADDRESS.toHexString()),
      Bytes.fromHexString(dataService.toHexString())
    )

    let expectedTokens = initialPoolTokens.plus(delegationRewards)
    assert.fieldEquals("DelegationPool", poolId.toHexString(), "tokens", expectedTokens.toString())
  })

  test("updates ServiceProvider tokensDelegated", () => {
    let initialDelegated = BigInt.fromString("5000000000000000000000")
    let delegationRewards = BigInt.fromString("100000000000000000000")

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialDelegated)
    setupServiceProvider(INDEXER_ADDRESS, initialDelegated)
    setupGraphNetwork(initialDelegated)

    let event = createRebateCollectedEvent(INDEXER_ADDRESS, delegationRewards)
    handleRebateCollected(event)

    let expectedDelegated = initialDelegated.plus(delegationRewards)
    assert.fieldEquals(
      "ServiceProvider",
      INDEXER_ADDRESS.toHexString(),
      "tokensDelegated",
      expectedDelegated.toString()
    )
  })

  test("updates GraphNetwork tokensDelegated", () => {
    let initialDelegated = BigInt.fromString("5000000000000000000000")
    let delegationRewards = BigInt.fromString("100000000000000000000")

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialDelegated)
    setupServiceProvider(INDEXER_ADDRESS, initialDelegated)
    setupGraphNetwork(initialDelegated)

    let event = createRebateCollectedEvent(INDEXER_ADDRESS, delegationRewards)
    handleRebateCollected(event)

    let expectedDelegated = initialDelegated.plus(delegationRewards)
    assert.fieldEquals(
      "GraphNetwork",
      GRAPH_NETWORK_ID.toHexString(),
      "tokensDelegated",
      expectedDelegated.toString()
    )
  })

  test("skips if delegationRewards is zero", () => {
    let initialPoolTokens = BigInt.fromString("5000000000000000000000")

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialPoolTokens)
    setupServiceProvider(INDEXER_ADDRESS, initialPoolTokens)
    setupGraphNetwork(initialPoolTokens)

    let event = createRebateCollectedEvent(INDEXER_ADDRESS, BigInt.zero())
    handleRebateCollected(event)

    // Pool tokens should remain unchanged
    let dataService = config.subgraphServiceAddress
    let poolId = getDelegationPoolId(
      Bytes.fromHexString(INDEXER_ADDRESS.toHexString()),
      Bytes.fromHexString(dataService.toHexString())
    )
    assert.fieldEquals("DelegationPool", poolId.toHexString(), "tokens", initialPoolTokens.toString())
  })

  test("skips if DelegationPool does not exist", () => {
    // Don't set up pool - only SP and network
    setupDataService(config.subgraphServiceAddress)
    setupServiceProvider(INDEXER_ADDRESS, BigInt.zero())
    setupGraphNetwork(BigInt.zero())

    let delegationRewards = BigInt.fromString("100000000000000000000")
    let event = createRebateCollectedEvent(INDEXER_ADDRESS, delegationRewards)

    // Should not throw - just skip
    handleRebateCollected(event)

    // GraphNetwork should not be updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", "0")
  })
})

// Helper to create a mock Log for HorizonRewardsAssigned event
function createHorizonRewardsAssignedLog(
  indexer: Address,
  allocationID: Address,
  rewards: BigInt
): ethereum.Log {
  // Pad addresses to 32 bytes for indexed topics
  let indexerTopic = Bytes.fromHexString("0x000000000000000000000000" + indexer.toHexString().slice(2))
  let allocationTopic = Bytes.fromHexString("0x000000000000000000000000" + allocationID.toHexString().slice(2))

  // Encode rewards as data
  let encodedRewards = ethereum.encode(ethereum.Value.fromUnsignedBigInt(rewards))!

  return new ethereum.Log(
    Address.zero(), // address (RewardsManager)
    [HORIZON_REWARDS_ASSIGNED_TOPIC, indexerTopic, allocationTopic], // topics
    Bytes.fromUint8Array(encodedRewards), // data
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"), // blockHash
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000001"), // blockNumber
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"), // transactionHash
    BigInt.fromI32(0), // transactionIndex
    BigInt.fromI32(0), // logIndex
    BigInt.fromI32(0), // transactionLogIndex
    "mined", // logType
    null // removed
  )
}

// Helper to create AllocationClosed event with receipt
function createAllocationClosedEventWithReceipt(
  indexer: Address,
  allocationID: Address,
  rewards: BigInt
): AllocationClosed {
  let event = newTypedMockEvent<AllocationClosed>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("indexer", ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam("subgraphDeploymentID", ethereum.Value.fromBytes(SUBGRAPH_DEPLOYMENT_ID)))
  event.parameters.push(new ethereum.EventParam("epoch", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10000))))
  event.parameters.push(new ethereum.EventParam("allocationID", ethereum.Value.fromAddress(allocationID)))
  event.parameters.push(new ethereum.EventParam("sender", ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam("poi", ethereum.Value.fromBytes(Bytes.fromHexString("0x1234567890123456789012345678901234567890123456789012345678901234"))))
  event.parameters.push(new ethereum.EventParam("isPublic", ethereum.Value.fromBoolean(false)))
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)

  // Create receipt with HorizonRewardsAssigned log
  let log = createHorizonRewardsAssignedLog(indexer, allocationID, rewards)
  event.receipt = new ethereum.TransactionReceipt(
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"), // transactionHash
    BigInt.fromI32(0), // transactionIndex
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"), // blockHash
    BigInt.fromI32(200), // blockNumber
    BigInt.fromI32(100000), // cumulativeGasUsed
    BigInt.fromI32(50000), // gasUsed
    Address.zero(), // contractAddress
    [log], // logs
    BigInt.fromI32(1), // status
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"), // root
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000") // logsBloom
  )

  return event
}

describe("handleAllocationClosed", () => {
  beforeEach(() => {
    clearStore()
  })

  test("calculates delegation rewards using legacyIndexingRewardCut", () => {
    // Set up pool with 50% cut (500000 PPM) - indexer keeps 50%, delegators get 50%
    let initialPoolTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let indexerCut = 500000 // 50%

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialPoolTokens, indexerCut)
    setupServiceProvider(INDEXER_ADDRESS, initialPoolTokens)
    setupGraphNetwork(initialPoolTokens)

    // Total rewards = 1000 GRT
    let totalRewards = BigInt.fromString("1000000000000000000000")
    // Expected delegation rewards = 1000 * (1 - 0.5) = 500 GRT
    let expectedDelegationRewards = BigInt.fromString("500000000000000000000")

    let event = createAllocationClosedEventWithReceipt(INDEXER_ADDRESS, ALLOCATION_ID, totalRewards)
    handleAllocationClosed(event)

    let dataService = config.subgraphServiceAddress
    let poolId = getDelegationPoolId(
      Bytes.fromHexString(INDEXER_ADDRESS.toHexString()),
      Bytes.fromHexString(dataService.toHexString())
    )

    let expectedPoolTokens = initialPoolTokens.plus(expectedDelegationRewards)
    assert.fieldEquals("DelegationPool", poolId.toHexString(), "tokens", expectedPoolTokens.toString())
  })

  test("updates ServiceProvider and GraphNetwork tokensDelegated", () => {
    let initialDelegated = BigInt.fromString("5000000000000000000000")
    let indexerCut = 800000 // 80% - delegators get 20%

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialDelegated, indexerCut)
    setupServiceProvider(INDEXER_ADDRESS, initialDelegated)
    setupGraphNetwork(initialDelegated)

    // Total rewards = 1000 GRT, delegation rewards = 200 GRT (20%)
    let totalRewards = BigInt.fromString("1000000000000000000000")
    let expectedDelegationRewards = BigInt.fromString("200000000000000000000")

    let event = createAllocationClosedEventWithReceipt(INDEXER_ADDRESS, ALLOCATION_ID, totalRewards)
    handleAllocationClosed(event)

    let expectedDelegated = initialDelegated.plus(expectedDelegationRewards)
    assert.fieldEquals("ServiceProvider", INDEXER_ADDRESS.toHexString(), "tokensDelegated", expectedDelegated.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", expectedDelegated.toString())
  })

  test("skips if DelegationPool does not exist", () => {
    // Don't set up pool
    setupDataService(config.subgraphServiceAddress)
    setupServiceProvider(INDEXER_ADDRESS, BigInt.zero())
    setupGraphNetwork(BigInt.zero())

    let totalRewards = BigInt.fromString("1000000000000000000000")
    let event = createAllocationClosedEventWithReceipt(INDEXER_ADDRESS, ALLOCATION_ID, totalRewards)

    // Should not throw
    handleAllocationClosed(event)

    // GraphNetwork should not be updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", "0")
  })

  test("skips if 100% indexer cut (no delegation rewards)", () => {
    let initialPoolTokens = BigInt.fromString("5000000000000000000000")
    let indexerCut = 1000000 // 100% - delegators get 0%

    setupDataService(config.subgraphServiceAddress)
    setupDelegationPool(INDEXER_ADDRESS, initialPoolTokens, indexerCut)
    setupServiceProvider(INDEXER_ADDRESS, initialPoolTokens)
    setupGraphNetwork(initialPoolTokens)

    let totalRewards = BigInt.fromString("1000000000000000000000")
    let event = createAllocationClosedEventWithReceipt(INDEXER_ADDRESS, ALLOCATION_ID, totalRewards)
    handleAllocationClosed(event)

    // Pool should not be updated (delegation rewards = 0)
    let dataService = config.subgraphServiceAddress
    let poolId = getDelegationPoolId(
      Bytes.fromHexString(INDEXER_ADDRESS.toHexString()),
      Bytes.fromHexString(dataService.toHexString())
    )
    assert.fieldEquals("DelegationPool", poolId.toHexString(), "tokens", initialPoolTokens.toString())
  })
})
