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
  DelegationFeeCutSet,
  HorizonStakeDeposited,
  ProvisionCreated,
} from "../generated/HorizonStaking/HorizonStaking"
import { handleDelegationFeeCutSet } from "../src/handlers/feeCut"
import { handleHorizonStakeDeposited } from "../src/handlers/staking"
import { handleProvisionCreated } from "../src/handlers/provision"
import { getProvisionFeeCutId } from "../src/entities/provisionFeeCut"
import { getProvisionId } from "../src/entities/provision"

// Test addresses
const SP_ADDRESS = Address.fromString("0x1234567890123456789012345678901234567890")
const VERIFIER_ADDRESS = Address.fromString("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")

// Payment types (from IGraphPayments.PaymentTypes enum)
const PAYMENT_TYPE_QUERY_FEE = 0
const PAYMENT_TYPE_INDEXING_FEE = 1
const PAYMENT_TYPE_INDEXING_REWARD = 2

// Helper to create stake deposit
function createStakeDepositedEvent(serviceProvider: Address, tokens: BigInt): HorizonStakeDeposited {
  let event = newTypedMockEvent<HorizonStakeDeposited>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(100)
  event.block.timestamp = BigInt.fromI32(1000)
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
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)
  return event
}

// Helper to create DelegationFeeCutSet event
function createDelegationFeeCutSetEvent(
  serviceProvider: Address,
  verifier: Address,
  paymentType: i32,
  feeCut: BigInt
): DelegationFeeCutSet {
  let event = newTypedMockEvent<DelegationFeeCutSet>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("paymentType", ethereum.Value.fromI32(paymentType)))
  event.parameters.push(new ethereum.EventParam("feeCut", ethereum.Value.fromUnsignedBigInt(feeCut)))
  event.block.number = BigInt.fromI32(300)
  event.block.timestamp = BigInt.fromI32(3000)
  return event
}

function setupServiceProviderAndProvision(): void {
  // Deposit stake
  let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
  let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
  handleHorizonStakeDeposited(depositEvent)

  // Create provision
  let provisionTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
  let provisionEvent = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, provisionTokens)
  handleProvisionCreated(provisionEvent)
}

function getFeeCutIdString(sp: Address, verifier: Address, paymentType: i32): string {
  return getProvisionFeeCutId(
    Bytes.fromHexString(sp.toHexString()),
    Bytes.fromHexString(verifier.toHexString()),
    paymentType
  ).toHexString()
}

function getProvisionIdString(sp: Address, verifier: Address): string {
  return getProvisionId(
    Bytes.fromHexString(sp.toHexString()),
    Bytes.fromHexString(verifier.toHexString())
  ).toHexString()
}

describe("DelegationFeeCutSet", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates ProvisionFeeCut entity for query fee type", () => {
    setupServiceProviderAndProvision()

    let feeCut = BigInt.fromI32(100000) // 10% in PPM
    let event = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_QUERY_FEE,
      feeCut
    )
    handleDelegationFeeCutSet(event)

    let entityId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_QUERY_FEE)
    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)

    assert.entityCount("ProvisionFeeCut", 1)
    assert.fieldEquals("ProvisionFeeCut", entityId, "provision", provisionId)
    assert.fieldEquals("ProvisionFeeCut", entityId, "paymentType", PAYMENT_TYPE_QUERY_FEE.toString())
    assert.fieldEquals("ProvisionFeeCut", entityId, "feeCut", feeCut.toString())
    assert.fieldEquals("ProvisionFeeCut", entityId, "updatedAtBlock", "300")
    assert.fieldEquals("ProvisionFeeCut", entityId, "updatedAt", "3000")
  })

  test("creates separate entities for different payment types", () => {
    setupServiceProviderAndProvision()

    // Set query fee cut
    let queryFeeCut = BigInt.fromI32(100000) // 10%
    let queryEvent = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_QUERY_FEE,
      queryFeeCut
    )
    handleDelegationFeeCutSet(queryEvent)

    // Set indexing fee cut
    let indexingFeeCut = BigInt.fromI32(200000) // 20%
    let indexingEvent = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_INDEXING_FEE,
      indexingFeeCut
    )
    indexingEvent.block.number = BigInt.fromI32(301)
    indexingEvent.block.timestamp = BigInt.fromI32(3100)
    handleDelegationFeeCutSet(indexingEvent)

    // Set indexing reward cut
    let rewardFeeCut = BigInt.fromI32(50000) // 5%
    let rewardEvent = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_INDEXING_REWARD,
      rewardFeeCut
    )
    rewardEvent.block.number = BigInt.fromI32(302)
    rewardEvent.block.timestamp = BigInt.fromI32(3200)
    handleDelegationFeeCutSet(rewardEvent)

    assert.entityCount("ProvisionFeeCut", 3)

    let queryId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_QUERY_FEE)
    let indexingId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_INDEXING_FEE)
    let rewardId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_INDEXING_REWARD)

    assert.fieldEquals("ProvisionFeeCut", queryId, "paymentType", PAYMENT_TYPE_QUERY_FEE.toString())
    assert.fieldEquals("ProvisionFeeCut", queryId, "feeCut", queryFeeCut.toString())

    assert.fieldEquals("ProvisionFeeCut", indexingId, "paymentType", PAYMENT_TYPE_INDEXING_FEE.toString())
    assert.fieldEquals("ProvisionFeeCut", indexingId, "feeCut", indexingFeeCut.toString())

    assert.fieldEquals("ProvisionFeeCut", rewardId, "paymentType", PAYMENT_TYPE_INDEXING_REWARD.toString())
    assert.fieldEquals("ProvisionFeeCut", rewardId, "feeCut", rewardFeeCut.toString())
  })

  test("updates existing fee cut for same payment type", () => {
    setupServiceProviderAndProvision()

    // Initial fee cut
    let initialFeeCut = BigInt.fromI32(100000) // 10%
    let event1 = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_QUERY_FEE,
      initialFeeCut
    )
    handleDelegationFeeCutSet(event1)

    let entityId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_QUERY_FEE)
    assert.fieldEquals("ProvisionFeeCut", entityId, "feeCut", initialFeeCut.toString())
    assert.fieldEquals("ProvisionFeeCut", entityId, "updatedAtBlock", "300")

    // Update fee cut
    let updatedFeeCut = BigInt.fromI32(150000) // 15%
    let event2 = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_QUERY_FEE,
      updatedFeeCut
    )
    event2.block.number = BigInt.fromI32(400)
    event2.block.timestamp = BigInt.fromI32(4000)
    handleDelegationFeeCutSet(event2)

    // Should still be 1 entity, but updated
    assert.entityCount("ProvisionFeeCut", 1)
    assert.fieldEquals("ProvisionFeeCut", entityId, "feeCut", updatedFeeCut.toString())
    assert.fieldEquals("ProvisionFeeCut", entityId, "updatedAtBlock", "400")
    assert.fieldEquals("ProvisionFeeCut", entityId, "updatedAt", "4000")
  })

  test("handles fee cut set to zero", () => {
    setupServiceProviderAndProvision()

    // Set fee cut to zero (100% goes to delegators)
    let feeCut = BigInt.fromI32(0)
    let event = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_QUERY_FEE,
      feeCut
    )
    handleDelegationFeeCutSet(event)

    let entityId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_QUERY_FEE)
    assert.fieldEquals("ProvisionFeeCut", entityId, "feeCut", "0")
  })

  test("handles max fee cut (100%)", () => {
    setupServiceProviderAndProvision()

    // Set fee cut to 100% (1000000 PPM)
    let feeCut = BigInt.fromI32(1000000) // 100% in PPM
    let event = createDelegationFeeCutSetEvent(
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      PAYMENT_TYPE_QUERY_FEE,
      feeCut
    )
    handleDelegationFeeCutSet(event)

    let entityId = getFeeCutIdString(SP_ADDRESS, VERIFIER_ADDRESS, PAYMENT_TYPE_QUERY_FEE)
    assert.fieldEquals("ProvisionFeeCut", entityId, "feeCut", feeCut.toString())
  })
})
