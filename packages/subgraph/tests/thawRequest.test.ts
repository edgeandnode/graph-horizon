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
  ThawRequestCreated,
  ThawRequestFulfilled,
  HorizonStakeDeposited,
  ProvisionCreated,
} from "../generated/HorizonStaking/HorizonStaking"
import {
  handleThawRequestCreated,
  handleThawRequestFulfilled,
} from "../src/handlers/thawRequest"
import { handleHorizonStakeDeposited } from "../src/handlers/staking"
import { handleProvisionCreated } from "../src/handlers/provision"
import { getProvisionId } from "../src/entities/provision"

// Test addresses
const SP_ADDRESS = Address.fromString("0x1234567890123456789012345678901234567890")
const VERIFIER_ADDRESS = Address.fromString("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
const THAW_REQUEST_ID = Bytes.fromHexString("0x1111111111111111111111111111111111111111111111111111111111111111")
const THAW_REQUEST_ID_2 = Bytes.fromHexString("0x2222222222222222222222222222222222222222222222222222222222222222")

// ThawRequestType enum values
const THAW_REQUEST_TYPE_PROVISION = 0
const THAW_REQUEST_TYPE_DELEGATION = 1

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

// Helper to create ThawRequestCreated event
function createThawRequestCreatedEvent(
  requestType: i32,
  serviceProvider: Address,
  verifier: Address,
  owner: Address,
  shares: BigInt,
  thawingUntil: BigInt,
  thawRequestId: Bytes,
  nonce: BigInt
): ThawRequestCreated {
  let event = newTypedMockEvent<ThawRequestCreated>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("requestType", ethereum.Value.fromI32(requestType)))
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)))
  event.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)))
  event.parameters.push(new ethereum.EventParam("thawingUntil", ethereum.Value.fromUnsignedBigInt(thawingUntil)))
  event.parameters.push(new ethereum.EventParam("thawRequestId", ethereum.Value.fromBytes(thawRequestId)))
  event.parameters.push(new ethereum.EventParam("nonce", ethereum.Value.fromUnsignedBigInt(nonce)))
  event.block.number = BigInt.fromI32(300)
  event.block.timestamp = BigInt.fromI32(3000)
  return event
}

// Helper to create ThawRequestFulfilled event
function createThawRequestFulfilledEvent(
  requestType: i32,
  thawRequestId: Bytes,
  tokens: BigInt,
  shares: BigInt,
  thawingUntil: BigInt,
  valid: boolean
): ThawRequestFulfilled {
  let event = newTypedMockEvent<ThawRequestFulfilled>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("requestType", ethereum.Value.fromI32(requestType)))
  event.parameters.push(new ethereum.EventParam("thawRequestId", ethereum.Value.fromBytes(thawRequestId)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)))
  event.parameters.push(new ethereum.EventParam("thawingUntil", ethereum.Value.fromUnsignedBigInt(thawingUntil)))
  event.parameters.push(new ethereum.EventParam("valid", ethereum.Value.fromBoolean(valid)))
  event.block.number = BigInt.fromI32(400)
  event.block.timestamp = BigInt.fromI32(4000)
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

function getProvisionIdString(sp: Address, verifier: Address): string {
  return getProvisionId(Bytes.fromHexString(sp.toHexString()), Bytes.fromHexString(verifier.toHexString())).toHexString()
}

describe("ThawRequestCreated", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates ProvisionThawRequest entity for provision type", () => {
    setupServiceProviderAndProvision()

    let shares = BigInt.fromString("1000000000000000000000") // 1000 shares
    let thawingUntil = BigInt.fromI32(3000 + 2592000) // current time + 30 days
    let nonce = BigInt.fromI32(1)

    let event = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS, // owner is SP for provision thaws
      shares,
      thawingUntil,
      THAW_REQUEST_ID,
      nonce
    )
    handleThawRequestCreated(event)

    // Check entity was created
    assert.entityCount("ProvisionThawRequest", 1)
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "shares", shares.toString())
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "thawingUntil", thawingUntil.toString())
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "thawingNonce", nonce.toString())
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "valid", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "fulfilled", "false")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "createdAtBlock", "300")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "createdAt", "3000")

    // Check relationships
    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "provision", provisionId)
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "serviceProvider", SP_ADDRESS.toHexString())
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "dataService", VERIFIER_ADDRESS.toHexString())
  })

  test("ignores delegation type thaw requests", () => {
    setupServiceProviderAndProvision()

    let shares = BigInt.fromString("1000000000000000000000")
    let thawingUntil = BigInt.fromI32(3000 + 2592000)
    let nonce = BigInt.fromI32(1)

    let event = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_DELEGATION, // delegation type
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      Address.fromString("0x9999999999999999999999999999999999999999"), // delegator
      shares,
      thawingUntil,
      THAW_REQUEST_ID,
      nonce
    )
    handleThawRequestCreated(event)

    // No entity should be created
    assert.entityCount("ProvisionThawRequest", 0)
  })

  test("handles multiple thaw requests", () => {
    setupServiceProviderAndProvision()

    // First thaw request
    let event1 = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS,
      BigInt.fromString("500000000000000000000"),
      BigInt.fromI32(3000 + 2592000),
      THAW_REQUEST_ID,
      BigInt.fromI32(1)
    )
    handleThawRequestCreated(event1)

    // Second thaw request
    let event2 = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS,
      BigInt.fromString("300000000000000000000"),
      BigInt.fromI32(3500 + 2592000),
      THAW_REQUEST_ID_2,
      BigInt.fromI32(2)
    )
    event2.block.number = BigInt.fromI32(350)
    event2.block.timestamp = BigInt.fromI32(3500)
    handleThawRequestCreated(event2)

    assert.entityCount("ProvisionThawRequest", 2)
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "thawingNonce", "1")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID_2.toHexString(), "thawingNonce", "2")
  })
})

describe("ThawRequestFulfilled", () => {
  beforeEach(() => {
    clearStore()
  })

  test("marks thaw request as fulfilled with tokens", () => {
    setupServiceProviderAndProvision()

    // Create thaw request
    let shares = BigInt.fromString("1000000000000000000000")
    let thawingUntil = BigInt.fromI32(3000 + 2592000)
    let createEvent = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS,
      shares,
      thawingUntil,
      THAW_REQUEST_ID,
      BigInt.fromI32(1)
    )
    handleThawRequestCreated(createEvent)

    // Fulfill thaw request
    let tokensWithdrawn = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let fulfillEvent = createThawRequestFulfilledEvent(
      THAW_REQUEST_TYPE_PROVISION,
      THAW_REQUEST_ID,
      tokensWithdrawn,
      shares,
      thawingUntil,
      true // valid
    )
    handleThawRequestFulfilled(fulfillEvent)

    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "fulfilled", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "valid", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "tokensWithdrawn", tokensWithdrawn.toString())
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "updatedAtBlock", "400")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "updatedAt", "4000")
  })

  test("marks slashed thaw request as invalid", () => {
    setupServiceProviderAndProvision()

    // Create thaw request
    let shares = BigInt.fromString("1000000000000000000000")
    let thawingUntil = BigInt.fromI32(3000 + 2592000)
    let createEvent = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS,
      shares,
      thawingUntil,
      THAW_REQUEST_ID,
      BigInt.fromI32(1)
    )
    handleThawRequestCreated(createEvent)

    // Fulfill thaw request as invalid (slashed)
    let tokensWithdrawn = BigInt.fromString("500000000000000000000") // Less than shares due to slashing
    let fulfillEvent = createThawRequestFulfilledEvent(
      THAW_REQUEST_TYPE_PROVISION,
      THAW_REQUEST_ID,
      tokensWithdrawn,
      shares,
      thawingUntil,
      false // invalid due to slashing
    )
    handleThawRequestFulfilled(fulfillEvent)

    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "fulfilled", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "valid", "false")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "tokensWithdrawn", tokensWithdrawn.toString())
  })

  test("ignores delegation type fulfillment", () => {
    setupServiceProviderAndProvision()

    // Create provision thaw request
    let createEvent = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS,
      BigInt.fromString("1000000000000000000000"),
      BigInt.fromI32(3000 + 2592000),
      THAW_REQUEST_ID,
      BigInt.fromI32(1)
    )
    handleThawRequestCreated(createEvent)

    // Try to fulfill with delegation type (should be ignored)
    let fulfillEvent = createThawRequestFulfilledEvent(
      THAW_REQUEST_TYPE_DELEGATION,
      THAW_REQUEST_ID,
      BigInt.fromString("1000000000000000000000"),
      BigInt.fromString("1000000000000000000000"),
      BigInt.fromI32(3000 + 2592000),
      true
    )
    handleThawRequestFulfilled(fulfillEvent)

    // Should still be unfulfilled
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "fulfilled", "false")
  })
})

describe("Thaw request lifecycle", () => {
  beforeEach(() => {
    clearStore()
  })

  test("tracks thaw request from creation to fulfillment", () => {
    setupServiceProviderAndProvision()

    let shares = BigInt.fromString("2000000000000000000000") // 2000 shares
    let thawingUntil = BigInt.fromI32(3000 + 2592000)

    // 1. Create thaw request
    let createEvent = createThawRequestCreatedEvent(
      THAW_REQUEST_TYPE_PROVISION,
      SP_ADDRESS,
      VERIFIER_ADDRESS,
      SP_ADDRESS,
      shares,
      thawingUntil,
      THAW_REQUEST_ID,
      BigInt.fromI32(1)
    )
    handleThawRequestCreated(createEvent)

    // Verify initial state
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "fulfilled", "false")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "valid", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "shares", shares.toString())

    // 2. Fulfill thaw request
    let tokensWithdrawn = BigInt.fromString("2000000000000000000000") // Full amount
    let fulfillEvent = createThawRequestFulfilledEvent(
      THAW_REQUEST_TYPE_PROVISION,
      THAW_REQUEST_ID,
      tokensWithdrawn,
      shares,
      thawingUntil,
      true
    )
    handleThawRequestFulfilled(fulfillEvent)

    // Verify final state
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "fulfilled", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "valid", "true")
    assert.fieldEquals("ProvisionThawRequest", THAW_REQUEST_ID.toHexString(), "tokensWithdrawn", tokensWithdrawn.toString())
  })
})
