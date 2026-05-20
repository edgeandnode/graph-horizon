import {
  describe,
  test,
  beforeEach,
  clearStore,
  assert,
  newTypedMockEvent,
} from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { OperatorSet } from "../generated/HorizonStaking/HorizonStaking"
import { handleOperatorSet } from "../src/handlers/operator"
import { getOperatorAuthorizationId } from "../src/entities/operatorAuthorization"

// Test addresses
const OPERATOR_ADDRESS = Address.fromString("0x1111111111111111111111111111111111111111")
const OPERATOR_ADDRESS_2 = Address.fromString("0x2222222222222222222222222222222222222222")
const SP_ADDRESS = Address.fromString("0x3333333333333333333333333333333333333333")
const SP_ADDRESS_2 = Address.fromString("0x4444444444444444444444444444444444444444")
const VERIFIER_ADDRESS = Address.fromString("0x5555555555555555555555555555555555555555")
const VERIFIER_ADDRESS_2 = Address.fromString("0x6666666666666666666666666666666666666666")

// Helper to create OperatorSet event
function createOperatorSetEvent(
  serviceProvider: Address,
  verifier: Address,
  operator: Address,
  allowed: boolean,
  blockNumber: i32 = 100,
  timestamp: i32 = 1000
): OperatorSet {
  let event = newTypedMockEvent<OperatorSet>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)))
  event.parameters.push(new ethereum.EventParam("allowed", ethereum.Value.fromBoolean(allowed)))
  event.block.number = BigInt.fromI32(blockNumber)
  event.block.timestamp = BigInt.fromI32(timestamp)
  return event
}

function getAuthorizationIdString(operator: Address, sp: Address, verifier: Address): string {
  return getOperatorAuthorizationId(
    Bytes.fromHexString(operator.toHexString()),
    Bytes.fromHexString(sp.toHexString()),
    Bytes.fromHexString(verifier.toHexString())
  ).toHexString()
}

describe("OperatorSet", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates Operator and OperatorAuthorization entities when operator is set", () => {
    let event = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true)
    handleOperatorSet(event)

    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()
    let authorizationId = getAuthorizationIdString(OPERATOR_ADDRESS, SP_ADDRESS, VERIFIER_ADDRESS)

    // Verify Operator entity
    assert.entityCount("Operator", 1)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "1")
    assert.fieldEquals("Operator", operatorId, "createdAtBlock", "100")
    assert.fieldEquals("Operator", operatorId, "createdAt", "1000")

    // Verify OperatorAuthorization entity
    assert.entityCount("OperatorAuthorization", 1)
    assert.fieldEquals("OperatorAuthorization", authorizationId, "operator", operatorId)
    assert.fieldEquals("OperatorAuthorization", authorizationId, "serviceProvider", Bytes.fromHexString(SP_ADDRESS.toHexString()).toHexString())
    assert.fieldEquals("OperatorAuthorization", authorizationId, "dataService", Bytes.fromHexString(VERIFIER_ADDRESS.toHexString()).toHexString())
    assert.fieldEquals("OperatorAuthorization", authorizationId, "allowed", "true")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "createdAtBlock", "100")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "createdAt", "1000")
  })

  test("revokes authorization when allowed is false", () => {
    // First authorize
    let authorizeEvent = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 100, 1000)
    handleOperatorSet(authorizeEvent)

    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()
    let authorizationId = getAuthorizationIdString(OPERATOR_ADDRESS, SP_ADDRESS, VERIFIER_ADDRESS)

    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "1")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "allowed", "true")

    // Then revoke
    let revokeEvent = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, false, 200, 2000)
    handleOperatorSet(revokeEvent)

    // Verify authorization is revoked
    assert.fieldEquals("OperatorAuthorization", authorizationId, "allowed", "false")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "updatedAtBlock", "200")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "updatedAt", "2000")

    // Verify count decreased
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "0")
  })

  test("re-authorizing after revoke increments count", () => {
    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()

    // Authorize
    let event1 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 100, 1000)
    handleOperatorSet(event1)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "1")

    // Revoke
    let event2 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, false, 200, 2000)
    handleOperatorSet(event2)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "0")

    // Re-authorize
    let event3 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 300, 3000)
    handleOperatorSet(event3)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "1")
  })

  test("multiple authorizations for same operator", () => {
    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()

    // Authorize for first SP + verifier
    let event1 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 100, 1000)
    handleOperatorSet(event1)

    // Authorize for second SP
    let event2 = createOperatorSetEvent(SP_ADDRESS_2, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 101, 1010)
    handleOperatorSet(event2)

    // Authorize for second verifier
    let event3 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS_2, OPERATOR_ADDRESS, true, 102, 1020)
    handleOperatorSet(event3)

    // Verify counts
    assert.entityCount("Operator", 1)
    assert.entityCount("OperatorAuthorization", 3)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "3")
  })

  test("multiple operators authorized by same service provider", () => {
    // Authorize first operator
    let event1 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 100, 1000)
    handleOperatorSet(event1)

    // Authorize second operator
    let event2 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS_2, true, 101, 1010)
    handleOperatorSet(event2)

    let operatorId1 = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()
    let operatorId2 = Bytes.fromHexString(OPERATOR_ADDRESS_2.toHexString()).toHexString()

    assert.entityCount("Operator", 2)
    assert.entityCount("OperatorAuthorization", 2)
    assert.fieldEquals("Operator", operatorId1, "countAuthorizations", "1")
    assert.fieldEquals("Operator", operatorId2, "countAuthorizations", "1")
  })

  test("setting allowed to same value does not change count", () => {
    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()

    // Authorize
    let event1 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 100, 1000)
    handleOperatorSet(event1)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "1")

    // Authorize again (same value)
    let event2 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 200, 2000)
    handleOperatorSet(event2)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "1")
  })

  test("revoking already revoked does not change count", () => {
    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()
    let authorizationId = getAuthorizationIdString(OPERATOR_ADDRESS, SP_ADDRESS, VERIFIER_ADDRESS)

    // Authorize
    let event1 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, true, 100, 1000)
    handleOperatorSet(event1)

    // Revoke
    let event2 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, false, 200, 2000)
    handleOperatorSet(event2)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "0")

    // Revoke again (same value)
    let event3 = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, false, 300, 3000)
    handleOperatorSet(event3)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "0")

    // Verify timestamps updated
    assert.fieldEquals("OperatorAuthorization", authorizationId, "updatedAtBlock", "300")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "updatedAt", "3000")
  })

  test("authorization entity is created even when initially set to false", () => {
    // Edge case: setting allowed=false before any authorization exists
    let event = createOperatorSetEvent(SP_ADDRESS, VERIFIER_ADDRESS, OPERATOR_ADDRESS, false)
    handleOperatorSet(event)

    let operatorId = Bytes.fromHexString(OPERATOR_ADDRESS.toHexString()).toHexString()
    let authorizationId = getAuthorizationIdString(OPERATOR_ADDRESS, SP_ADDRESS, VERIFIER_ADDRESS)

    // Both entities should exist
    assert.entityCount("Operator", 1)
    assert.entityCount("OperatorAuthorization", 1)

    // Count should be 0 (was false -> false, no change)
    assert.fieldEquals("Operator", operatorId, "countAuthorizations", "0")
    assert.fieldEquals("OperatorAuthorization", authorizationId, "allowed", "false")
  })
})
