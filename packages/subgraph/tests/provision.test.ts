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
  ProvisionCreated,
  ProvisionIncreased,
  ProvisionThawed,
  ProvisionSlashed,
  ProvisionParametersStaged,
  ProvisionParametersSet,
  HorizonStakeDeposited
} from "../generated/HorizonStaking/HorizonStaking"
import {
  handleProvisionCreated,
  handleProvisionIncreased,
  handleProvisionThawed,
  handleProvisionSlashed,
  handleProvisionParametersStaged,
  handleProvisionParametersSet
} from "../src/handlers/provision"
import { handleHorizonStakeDeposited } from "../src/handlers/staking"
import { GRAPH_NETWORK_ID } from "../src/common/constants"
import { getProvisionId } from "../src/entities/provision"

// Test addresses
const SP_ADDRESS = Address.fromString("0x1234567890123456789012345678901234567890")
const VERIFIER_ADDRESS = Address.fromString("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
const VERIFIER_ADDRESS_2 = Address.fromString("0x9999999999999999999999999999999999999999")

// Helper to create stake deposit (to set up ServiceProvider)
function createStakeDepositedEvent(serviceProvider: Address, tokens: BigInt): HorizonStakeDeposited {
  let event = newTypedMockEvent<HorizonStakeDeposited>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(100)
  event.block.timestamp = BigInt.fromI32(1000)
  return event
}

// Helper to create ProvisionCreated event
function createProvisionCreatedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
  maxVerifierCut: BigInt,
  thawingPeriod: BigInt
): ProvisionCreated {
  let event = newTypedMockEvent<ProvisionCreated>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("maxVerifierCut", ethereum.Value.fromUnsignedBigInt(maxVerifierCut)))
  event.parameters.push(new ethereum.EventParam("thawingPeriod", ethereum.Value.fromUnsignedBigInt(thawingPeriod)))
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)
  return event
}

// Helper to create ProvisionIncreased event
function createProvisionIncreasedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt
): ProvisionIncreased {
  let event = newTypedMockEvent<ProvisionIncreased>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(300)
  event.block.timestamp = BigInt.fromI32(3000)
  return event
}

// Helper to create ProvisionThawed event
function createProvisionThawedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt
): ProvisionThawed {
  let event = newTypedMockEvent<ProvisionThawed>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(400)
  event.block.timestamp = BigInt.fromI32(4000)
  return event
}

// Helper to create ProvisionSlashed event
function createProvisionSlashedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt
): ProvisionSlashed {
  let event = newTypedMockEvent<ProvisionSlashed>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(500)
  event.block.timestamp = BigInt.fromI32(5000)
  return event
}

// Helper to create ProvisionParametersStaged event
function createProvisionParametersStagedEvent(
  serviceProvider: Address,
  verifier: Address,
  maxVerifierCut: BigInt,
  thawingPeriod: BigInt
): ProvisionParametersStaged {
  let event = newTypedMockEvent<ProvisionParametersStaged>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("maxVerifierCut", ethereum.Value.fromUnsignedBigInt(maxVerifierCut)))
  event.parameters.push(new ethereum.EventParam("thawingPeriod", ethereum.Value.fromUnsignedBigInt(thawingPeriod)))
  event.block.number = BigInt.fromI32(600)
  event.block.timestamp = BigInt.fromI32(6000)
  return event
}

// Helper to create ProvisionParametersSet event
function createProvisionParametersSetEvent(
  serviceProvider: Address,
  verifier: Address,
  maxVerifierCut: BigInt,
  thawingPeriod: BigInt
): ProvisionParametersSet {
  let event = newTypedMockEvent<ProvisionParametersSet>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("maxVerifierCut", ethereum.Value.fromUnsignedBigInt(maxVerifierCut)))
  event.parameters.push(new ethereum.EventParam("thawingPeriod", ethereum.Value.fromUnsignedBigInt(thawingPeriod)))
  event.block.number = BigInt.fromI32(700)
  event.block.timestamp = BigInt.fromI32(7000)
  return event
}

function getProvisionIdString(sp: Address, verifier: Address): string {
  return getProvisionId(Bytes.fromHexString(sp.toHexString()), Bytes.fromHexString(verifier.toHexString())).toHexString()
}

describe("ProvisionCreated", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates new Provision entity", () => {
    // First deposit stake
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    // Create provision
    let provisionTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let maxVerifierCut = BigInt.fromI32(100000) // 10% in PPM
    let thawingPeriod = BigInt.fromI32(2592000) // 30 days in seconds

    let event = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, provisionTokens, maxVerifierCut, thawingPeriod)
    handleProvisionCreated(event)

    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)

    // Check Provision was created
    assert.entityCount("Provision", 1)
    assert.fieldEquals("Provision", provisionId, "tokens", provisionTokens.toString())
    assert.fieldEquals("Provision", provisionId, "tokensThawing", "0")
    assert.fieldEquals("Provision", provisionId, "maxVerifierCut", maxVerifierCut.toString())
    assert.fieldEquals("Provision", provisionId, "thawingPeriod", thawingPeriod.toString())
    assert.fieldEquals("Provision", provisionId, "createdAtBlock", "200")
    assert.fieldEquals("Provision", provisionId, "createdAt", "2000")

    // Check ServiceProvider was updated
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensProvisioned", provisionTokens.toString())
    let expectedIdle = stakeTokens.minus(provisionTokens)
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensIdle", expectedIdle.toString())

    // Check GraphNetwork was updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countProvisions", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensProvisioned", provisionTokens.toString())
  })

  test("handles multiple provisions to different verifiers", () => {
    // Deposit stake
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    // Create first provision
    let tokens1 = BigInt.fromString("3000000000000000000000") // 3000 GRT
    let event1 = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, tokens1, BigInt.fromI32(100000), BigInt.fromI32(2592000))
    handleProvisionCreated(event1)

    // Create second provision to different verifier
    let tokens2 = BigInt.fromString("2000000000000000000000") // 2000 GRT
    let event2 = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS_2, tokens2, BigInt.fromI32(50000), BigInt.fromI32(1296000))
    event2.block.number = BigInt.fromI32(250)
    event2.block.timestamp = BigInt.fromI32(2500)
    handleProvisionCreated(event2)

    assert.entityCount("Provision", 2)

    let totalProvisioned = tokens1.plus(tokens2)
    let expectedIdle = stakeTokens.minus(totalProvisioned)

    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensProvisioned", totalProvisioned.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensIdle", expectedIdle.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countProvisions", "2")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensProvisioned", totalProvisioned.toString())
  })
})

describe("ProvisionIncreased", () => {
  beforeEach(() => {
    clearStore()
  })

  test("increases tokens in existing provision", () => {
    // Setup: deposit and create provision
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    let initialTokens = BigInt.fromString("3000000000000000000000") // 3000 GRT
    let createEvent = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, initialTokens, BigInt.fromI32(100000), BigInt.fromI32(2592000))
    handleProvisionCreated(createEvent)

    // Increase provision
    let increaseAmount = BigInt.fromString("2000000000000000000000") // 2000 GRT
    let event = createProvisionIncreasedEvent(SP_ADDRESS, VERIFIER_ADDRESS, increaseAmount)
    handleProvisionIncreased(event)

    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    let totalProvisionTokens = initialTokens.plus(increaseAmount)

    assert.fieldEquals("Provision", provisionId, "tokens", totalProvisionTokens.toString())
    assert.fieldEquals("Provision", provisionId, "updatedAtBlock", "300")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensProvisioned", totalProvisionTokens.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensProvisioned", totalProvisionTokens.toString())
  })
})

describe("ProvisionThawed", () => {
  beforeEach(() => {
    clearStore()
  })

  test("moves tokens from provision to thawing", () => {
    // Setup: deposit and create provision
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    let provisionTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let createEvent = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, provisionTokens, BigInt.fromI32(100000), BigInt.fromI32(2592000))
    handleProvisionCreated(createEvent)

    // Thaw some tokens
    let thawAmount = BigInt.fromString("2000000000000000000000") // 2000 GRT
    let event = createProvisionThawedEvent(SP_ADDRESS, VERIFIER_ADDRESS, thawAmount)
    handleProvisionThawed(event)

    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    let remainingTokens = provisionTokens.minus(thawAmount)

    assert.fieldEquals("Provision", provisionId, "tokens", remainingTokens.toString())
    assert.fieldEquals("Provision", provisionId, "tokensThawing", thawAmount.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensProvisioned", remainingTokens.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensProvisioned", remainingTokens.toString())
  })
})

describe("ProvisionSlashed", () => {
  beforeEach(() => {
    clearStore()
  })

  test("reduces both provision and total stake", () => {
    // Setup: deposit and create provision
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    let provisionTokens = BigInt.fromString("5000000000000000000000") // 5000 GRT
    let createEvent = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, provisionTokens, BigInt.fromI32(100000), BigInt.fromI32(2592000))
    handleProvisionCreated(createEvent)

    // Slash
    let slashAmount = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let event = createProvisionSlashedEvent(SP_ADDRESS, VERIFIER_ADDRESS, slashAmount)
    handleProvisionSlashed(event)

    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    let remainingProvisionTokens = provisionTokens.minus(slashAmount)
    let remainingStake = stakeTokens.minus(slashAmount)
    let expectedIdle = remainingStake.minus(remainingProvisionTokens)

    // Provision tokens reduced
    assert.fieldEquals("Provision", provisionId, "tokens", remainingProvisionTokens.toString())

    // ServiceProvider stake and provisioned both reduced
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", remainingStake.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensProvisioned", remainingProvisionTokens.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensIdle", expectedIdle.toString())

    // GraphNetwork totals reduced
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", remainingStake.toString())
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensProvisioned", remainingProvisionTokens.toString())
  })
})

describe("ProvisionParametersStaged", () => {
  beforeEach(() => {
    clearStore()
  })

  test("stages new parameters on provision", () => {
    // Setup: deposit and create provision
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    let provisionTokens = BigInt.fromString("5000000000000000000000")
    let initialMaxCut = BigInt.fromI32(100000)
    let initialThawing = BigInt.fromI32(2592000)
    let createEvent = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, provisionTokens, initialMaxCut, initialThawing)
    handleProvisionCreated(createEvent)

    // Stage new parameters
    let newMaxCut = BigInt.fromI32(150000)
    let newThawing = BigInt.fromI32(3888000) // 45 days
    let event = createProvisionParametersStagedEvent(SP_ADDRESS, VERIFIER_ADDRESS, newMaxCut, newThawing)
    handleProvisionParametersStaged(event)

    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)

    // Current parameters unchanged
    assert.fieldEquals("Provision", provisionId, "maxVerifierCut", initialMaxCut.toString())
    assert.fieldEquals("Provision", provisionId, "thawingPeriod", initialThawing.toString())

    // Pending parameters set
    assert.fieldEquals("Provision", provisionId, "maxVerifierCutPending", newMaxCut.toString())
    assert.fieldEquals("Provision", provisionId, "thawingPeriodPending", newThawing.toString())
    assert.fieldEquals("Provision", provisionId, "lastParametersStagedAt", "6000")
  })
})

describe("ProvisionParametersSet", () => {
  beforeEach(() => {
    clearStore()
  })

  test("accepts staged parameters", () => {
    // Setup: deposit, create provision, stage parameters
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)

    let provisionTokens = BigInt.fromString("5000000000000000000000")
    let initialMaxCut = BigInt.fromI32(100000)
    let initialThawing = BigInt.fromI32(2592000)
    let createEvent = createProvisionCreatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, provisionTokens, initialMaxCut, initialThawing)
    handleProvisionCreated(createEvent)

    let newMaxCut = BigInt.fromI32(150000)
    let newThawing = BigInt.fromI32(3888000)
    let stageEvent = createProvisionParametersStagedEvent(SP_ADDRESS, VERIFIER_ADDRESS, newMaxCut, newThawing)
    handleProvisionParametersStaged(stageEvent)

    // Accept parameters
    let setEvent = createProvisionParametersSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, newMaxCut, newThawing)
    handleProvisionParametersSet(setEvent)

    let provisionId = getProvisionIdString(SP_ADDRESS, VERIFIER_ADDRESS)

    // Current parameters updated
    assert.fieldEquals("Provision", provisionId, "maxVerifierCut", newMaxCut.toString())
    assert.fieldEquals("Provision", provisionId, "thawingPeriod", newThawing.toString())

    // Pending parameters cleared
    assert.fieldEquals("Provision", provisionId, "maxVerifierCutPending", "0")
    assert.fieldEquals("Provision", provisionId, "thawingPeriodPending", "0")
  })
})
