import {
  describe,
  test,
  beforeEach,
  clearStore,
  assert,
  newTypedMockEvent,
} from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { GraphPaymentCollected } from "../generated/GraphPayments/GraphPayments"
import { handleGraphPaymentCollected } from "../src/handlers/payments"
import { HorizonStakeDeposited, ProvisionCreated, TokensDelegated } from "../generated/HorizonStaking/HorizonStaking"
import { handleHorizonStakeDeposited } from "../src/handlers/staking"
import { handleProvisionCreated } from "../src/handlers/provision"
import { handleTokensDelegated } from "../src/handlers/delegation"
import { GRAPH_NETWORK_ID, BIGINT_ZERO } from "../src/common/constants"
import { getDelegationPoolId } from "../src/entities/delegationPool"
import { DataService } from "../generated/schema"

// Test addresses
const PAYER_ADDRESS = Address.fromString("0x1111111111111111111111111111111111111111")
const RECEIVER_ADDRESS = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
const DATA_SERVICE_ADDRESS = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc")
const RECEIVER_DESTINATION = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd")
const DELEGATOR_ADDRESS = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")

// Payment types
const PAYMENT_TYPE_QUERY_FEE = 0

// Helper to create GraphPaymentCollected event
function createGraphPaymentCollectedEvent(
  paymentType: i32,
  payer: Address,
  receiver: Address,
  dataService: Address,
  tokens: BigInt,
  tokensProtocol: BigInt,
  tokensDataService: BigInt,
  tokensDelegationPool: BigInt,
  tokensReceiver: BigInt,
  receiverDestination: Address
): GraphPaymentCollected {
  let event = newTypedMockEvent<GraphPaymentCollected>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("paymentType", ethereum.Value.fromI32(paymentType)))
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)))
  event.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  event.parameters.push(new ethereum.EventParam("dataService", ethereum.Value.fromAddress(dataService)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("tokensProtocol", ethereum.Value.fromUnsignedBigInt(tokensProtocol)))
  event.parameters.push(new ethereum.EventParam("tokensDataService", ethereum.Value.fromUnsignedBigInt(tokensDataService)))
  event.parameters.push(new ethereum.EventParam("tokensDelegationPool", ethereum.Value.fromUnsignedBigInt(tokensDelegationPool)))
  event.parameters.push(new ethereum.EventParam("tokensReceiver", ethereum.Value.fromUnsignedBigInt(tokensReceiver)))
  event.parameters.push(new ethereum.EventParam("receiverDestination", ethereum.Value.fromAddress(receiverDestination)))
  event.block.number = BigInt.fromI32(100)
  event.block.timestamp = BigInt.fromI32(1000)
  return event
}

// Helper to create stake deposit
function createStakeDepositedEvent(serviceProvider: Address, tokens: BigInt): HorizonStakeDeposited {
  let event = newTypedMockEvent<HorizonStakeDeposited>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(50)
  event.block.timestamp = BigInt.fromI32(500)
  return event
}

// Helper to create provision
function createProvisionCreatedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt
): ProvisionCreated {
  let event = newTypedMockEvent<ProvisionCreated>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("maxVerifierCut", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100000))))
  event.parameters.push(new ethereum.EventParam("thawingPeriod", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2592000))))
  event.block.number = BigInt.fromI32(60)
  event.block.timestamp = BigInt.fromI32(600)
  return event
}

// Helper to create TokensDelegated event
function createTokensDelegatedEvent(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address,
  tokens: BigInt,
  shares: BigInt
): TokensDelegated {
  let event = newTypedMockEvent<TokensDelegated>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("delegator", ethereum.Value.fromAddress(delegator)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)))
  event.block.number = BigInt.fromI32(70)
  event.block.timestamp = BigInt.fromI32(700)
  return event
}

// Helper to set up DataService entity
function setupDataService(verifier: Address): void {
  let id = Bytes.fromHexString(verifier.toHexString())
  let ds = new DataService(id)
  ds.countServiceProviders = 0
  ds.countProvisions = 0
  ds.countDelegationPools = 0
  ds.countProvisionSlashEvents = 0
  ds.countDelegationPoolSlashEvents = 0
  ds.tokensProvisioned = BIGINT_ZERO
  ds.tokensDelegated = BIGINT_ZERO
  ds.tokensThawingFromProvisions = BIGINT_ZERO
  ds.tokensThawingFromDelegationPools = BIGINT_ZERO
  ds.tokensSlashed = BIGINT_ZERO
  ds.tokensSlashedFromProvisions = BIGINT_ZERO
  ds.tokensSlashedFromDelegationPools = BIGINT_ZERO
  ds.tokensCollected = BIGINT_ZERO
  ds.tokensDistributedToDataService = BIGINT_ZERO
  ds.tokensDistributedAsProtocolTax = BIGINT_ZERO
  ds.tokensDistributedToDelegationPools = BIGINT_ZERO
  ds.tokensDistributedToServiceProviders = BIGINT_ZERO
  ds.createdAtBlock = BigInt.fromI32(1)
  ds.createdAt = BigInt.fromI32(100)
  ds.updatedAtBlock = BigInt.fromI32(1)
  ds.updatedAt = BigInt.fromI32(100)
  ds.save()
}

function getDelegationPoolIdString(sp: Address, verifier: Address): string {
  return getDelegationPoolId(
    Bytes.fromHexString(sp.toHexString()),
    Bytes.fromHexString(verifier.toHexString())
  ).toHexString()
}

describe("handleGraphPaymentCollected", () => {
  beforeEach(() => {
    clearStore()
  })

  test("updates GraphNetwork payment aggregates", () => {
    let tokens = BigInt.fromString("1000000000000000000000") // 1000 GRT total
    let tokensProtocol = BigInt.fromString("10000000000000000000") // 10 GRT (1%)
    let tokensDataService = BigInt.fromString("50000000000000000000") // 50 GRT (5%)
    let tokensDelegationPool = BigInt.fromString("140000000000000000000") // 140 GRT (14%)
    let tokensReceiver = BigInt.fromString("800000000000000000000") // 800 GRT (80%)

    let event = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens,
      tokensProtocol,
      tokensDataService,
      tokensDelegationPool,
      tokensReceiver,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event)

    // Check GraphNetwork aggregates
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensCollected", tokens.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedAsProtocolTax", tokensProtocol.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedToDataServices", tokensDataService.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedToDelegationPools", tokensDelegationPool.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedToServiceProviders", tokensReceiver.toString())
  })

  test("updates ServiceProvider payment aggregates with full distribution breakdown", () => {
    let tokens = BigInt.fromString("1000000000000000000000")
    let tokensProtocol = BigInt.fromString("10000000000000000000")
    let tokensDataService = BigInt.fromString("50000000000000000000")
    let tokensDelegationPool = BigInt.fromString("140000000000000000000")
    let tokensReceiver = BigInt.fromString("800000000000000000000")

    let event = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens,
      tokensProtocol,
      tokensDataService,
      tokensDelegationPool,
      tokensReceiver,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event)

    // ServiceProvider should be created and updated with full breakdown
    assert.entityCount("ServiceProvider", 1)
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensCollected", tokens.toString())
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensDistributedToServiceProvider", tokensReceiver.toString())
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensDistributedAsProtocolTax", tokensProtocol.toString())
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensDistributedToDelegationPools", tokensDelegationPool.toString())
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensDistributedToDataServices", tokensDataService.toString())
  })

  test("creates DataService entity and tracks payment aggregates with full breakdown", () => {
    let tokens = BigInt.fromString("1000000000000000000000")
    let tokensProtocol = BigInt.fromString("10000000000000000000")
    let tokensDataService = BigInt.fromString("50000000000000000000")
    let tokensDelegationPool = BigInt.fromString("140000000000000000000")
    let tokensReceiver = BigInt.fromString("800000000000000000000")

    let event = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens,
      tokensProtocol,
      tokensDataService,
      tokensDelegationPool,
      tokensReceiver,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event)

    // DataService should be created with full payment breakdown
    assert.entityCount("DataService", 1)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countDataServices", "1")
    assert.fieldEquals("DataService", DATA_SERVICE_ADDRESS.toHexString(), "tokensCollected", tokens.toString())
    assert.fieldEquals("DataService", DATA_SERVICE_ADDRESS.toHexString(), "tokensDistributedToDataService", tokensDataService.toString())
    assert.fieldEquals("DataService", DATA_SERVICE_ADDRESS.toHexString(), "tokensDistributedAsProtocolTax", tokensProtocol.toString())
    assert.fieldEquals("DataService", DATA_SERVICE_ADDRESS.toHexString(), "tokensDistributedToDelegationPools", tokensDelegationPool.toString())
    assert.fieldEquals("DataService", DATA_SERVICE_ADDRESS.toHexString(), "tokensDistributedToServiceProviders", tokensReceiver.toString())
  })

  test("creates Provision entity and tracks tokensCollected", () => {
    let tokens = BigInt.fromString("1000000000000000000000")
    let tokensProtocol = BigInt.fromString("10000000000000000000")
    let tokensDataService = BigInt.fromString("50000000000000000000")
    let tokensDelegationPool = BigInt.fromString("0")
    let tokensReceiver = BigInt.fromString("940000000000000000000")

    let event = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens,
      tokensProtocol,
      tokensDataService,
      tokensDelegationPool,
      tokensReceiver,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event)

    // Provision should be created with tokensCollected
    assert.entityCount("Provision", 1)
    let provisionId = Bytes.fromHexString(RECEIVER_ADDRESS.toHexString()).concat(Bytes.fromHexString(DATA_SERVICE_ADDRESS.toHexString())).toHexString()
    assert.fieldEquals("Provision", provisionId, "tokensCollected", tokens.toString())
  })

  test("adds tokens to existing DelegationPool", () => {
    // Setup: create SP with stake, provision, and delegation pool
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(RECEIVER_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(DATA_SERVICE_ADDRESS)

    let provisionTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let provisionEvent = createProvisionCreatedEvent(RECEIVER_ADDRESS, DATA_SERVICE_ADDRESS, provisionTokens)
    handleProvisionCreated(provisionEvent)

    let delegatedTokens = BigInt.fromString("2000000000000000000000") // 2000 GRT
    let delegateEvent = createTokensDelegatedEvent(
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      DELEGATOR_ADDRESS,
      delegatedTokens,
      delegatedTokens
    )
    handleTokensDelegated(delegateEvent)

    let poolId = getDelegationPoolIdString(RECEIVER_ADDRESS, DATA_SERVICE_ADDRESS)
    assert.fieldEquals("DelegationPool", poolId, "tokens", delegatedTokens.toString())

    // Now process payment with delegation pool share
    let tokens = BigInt.fromString("1000000000000000000000")
    let tokensProtocol = BigInt.fromString("10000000000000000000")
    let tokensDataService = BigInt.fromString("50000000000000000000")
    let tokensDelegationPool = BigInt.fromString("140000000000000000000") // 140 GRT to delegators
    let tokensReceiver = BigInt.fromString("800000000000000000000")

    let event = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens,
      tokensProtocol,
      tokensDataService,
      tokensDelegationPool,
      tokensReceiver,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event)

    // DelegationPool should have increased tokens and track distribution
    let expectedPoolTokens = delegatedTokens.plus(tokensDelegationPool)
    assert.fieldEquals("DelegationPool", poolId, "tokens", expectedPoolTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "tokensDistributed", tokensDelegationPool.toString())
  })

  test("does not update DelegationPool if tokensDelegationPool is zero", () => {
    // Setup SP with delegation
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(RECEIVER_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(DATA_SERVICE_ADDRESS)

    let provisionTokens = BigInt.fromString("5000000000000000000000")
    let provisionEvent = createProvisionCreatedEvent(RECEIVER_ADDRESS, DATA_SERVICE_ADDRESS, provisionTokens)
    handleProvisionCreated(provisionEvent)

    let delegatedTokens = BigInt.fromString("2000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      DELEGATOR_ADDRESS,
      delegatedTokens,
      delegatedTokens
    )
    handleTokensDelegated(delegateEvent)

    let poolId = getDelegationPoolIdString(RECEIVER_ADDRESS, DATA_SERVICE_ADDRESS)

    // Payment with zero delegation pool share
    let tokens = BigInt.fromString("1000000000000000000000")
    let tokensProtocol = BigInt.fromString("10000000000000000000")
    let tokensDataService = BigInt.fromString("50000000000000000000")
    let tokensDelegationPool = BigInt.zero() // Nothing to delegators
    let tokensReceiver = BigInt.fromString("940000000000000000000")

    let event = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens,
      tokensProtocol,
      tokensDataService,
      tokensDelegationPool,
      tokensReceiver,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event)

    // DelegationPool tokens should remain unchanged
    assert.fieldEquals("DelegationPool", poolId, "tokens", delegatedTokens.toString())
  })

  test("accumulates aggregates across multiple payments", () => {
    // First payment
    let tokens1 = BigInt.fromString("1000000000000000000000")
    let tokensProtocol1 = BigInt.fromString("10000000000000000000")
    let tokensDataService1 = BigInt.fromString("50000000000000000000")
    let tokensDelegationPool1 = BigInt.fromString("0")
    let tokensReceiver1 = BigInt.fromString("940000000000000000000")

    let event1 = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens1,
      tokensProtocol1,
      tokensDataService1,
      tokensDelegationPool1,
      tokensReceiver1,
      RECEIVER_DESTINATION
    )
    handleGraphPaymentCollected(event1)

    // Second payment
    let tokens2 = BigInt.fromString("500000000000000000000")
    let tokensProtocol2 = BigInt.fromString("5000000000000000000")
    let tokensDataService2 = BigInt.fromString("25000000000000000000")
    let tokensDelegationPool2 = BigInt.fromString("0")
    let tokensReceiver2 = BigInt.fromString("470000000000000000000")

    let event2 = createGraphPaymentCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      RECEIVER_ADDRESS,
      DATA_SERVICE_ADDRESS,
      tokens2,
      tokensProtocol2,
      tokensDataService2,
      tokensDelegationPool2,
      tokensReceiver2,
      RECEIVER_DESTINATION
    )
    event2.block.number = BigInt.fromI32(200)
    event2.block.timestamp = BigInt.fromI32(2000)
    handleGraphPaymentCollected(event2)

    let totalTokens = tokens1.plus(tokens2)
    let totalProtocol = tokensProtocol1.plus(tokensProtocol2)
    let totalDataService = tokensDataService1.plus(tokensDataService2)
    let totalReceiver = tokensReceiver1.plus(tokensReceiver2)

    // GraphNetwork aggregates should accumulate
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensCollected", totalTokens.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedAsProtocolTax", totalProtocol.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedToDataServices", totalDataService.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDistributedToServiceProviders", totalReceiver.toString())

    // ServiceProvider aggregates should accumulate
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensCollected", totalTokens.toString())
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensDistributedToServiceProvider", totalReceiver.toString())
  })
})
