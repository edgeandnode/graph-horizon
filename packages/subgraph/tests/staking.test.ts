import {
  describe,
  test,
  beforeEach,
  clearStore,
  assert,
  newTypedMockEvent,
} from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { HorizonStakeDeposited, HorizonStakeWithdrawn } from "../generated/HorizonStaking/HorizonStaking"
import { handleHorizonStakeDeposited, handleHorizonStakeWithdrawn } from "../src/handlers/staking"
import { GRAPH_NETWORK_ID } from "../src/common/constants"

// Test addresses
const SP_ADDRESS = Address.fromString("0x1234567890123456789012345678901234567890")
const SP_ADDRESS_2 = Address.fromString("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")

// Helper to create HorizonStakeDeposited event
function createStakeDepositedEvent(serviceProvider: Address, tokens: BigInt): HorizonStakeDeposited {
  let event = newTypedMockEvent<HorizonStakeDeposited>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(100)
  event.block.timestamp = BigInt.fromI32(1000)
  return event
}

// Helper to create HorizonStakeWithdrawn event
function createStakeWithdrawnEvent(serviceProvider: Address, tokens: BigInt): HorizonStakeWithdrawn {
  let event = newTypedMockEvent<HorizonStakeWithdrawn>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)
  return event
}

describe("HorizonStakeDeposited", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates new ServiceProvider on first deposit", () => {
    let tokens = BigInt.fromString("1000000000000000000000") // 1000 GRT

    let event = createStakeDepositedEvent(SP_ADDRESS, tokens)
    handleHorizonStakeDeposited(event)

    // Check ServiceProvider was created
    assert.entityCount("ServiceProvider", 1)
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", tokens.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensProvisioned", "0")
    // tokensIdle = tokensStaked - tokensProvisioned = 1000 GRT
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensIdle", tokens.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "createdAtBlock", "100")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "createdAt", "1000")

    // Check GraphNetwork was updated
    assert.entityCount("GraphNetwork", 1)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", tokens.toString())
  })

  test("increments stake on existing ServiceProvider", () => {
    let firstDeposit = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let secondDeposit = BigInt.fromString("500000000000000000000") // 500 GRT
    let totalStake = firstDeposit.plus(secondDeposit)

    // First deposit
    let event1 = createStakeDepositedEvent(SP_ADDRESS, firstDeposit)
    handleHorizonStakeDeposited(event1)

    // Second deposit
    let event2 = createStakeDepositedEvent(SP_ADDRESS, secondDeposit)
    event2.block.number = BigInt.fromI32(150)
    event2.block.timestamp = BigInt.fromI32(1500)
    handleHorizonStakeDeposited(event2)

    // Check ServiceProvider stake was incremented
    assert.entityCount("ServiceProvider", 1)
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", totalStake.toString())

    // createdAt should remain from first deposit
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "createdAtBlock", "100")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "createdAt", "1000")

    // updatedAt should be from second deposit
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "updatedAtBlock", "150")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "updatedAt", "1500")

    // GraphNetwork count should still be 1
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", totalStake.toString())
  })

  test("handles multiple ServiceProviders", () => {
    let tokens1 = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let tokens2 = BigInt.fromString("2000000000000000000000") // 2000 GRT
    let totalStake = tokens1.plus(tokens2)

    let event1 = createStakeDepositedEvent(SP_ADDRESS, tokens1)
    handleHorizonStakeDeposited(event1)

    let event2 = createStakeDepositedEvent(SP_ADDRESS_2, tokens2)
    handleHorizonStakeDeposited(event2)

    assert.entityCount("ServiceProvider", 2)
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", tokens1.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS_2.toHexString(), "tokensStaked", tokens2.toString())

    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "2")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", totalStake.toString())
  })
})

describe("HorizonStakeWithdrawn", () => {
  beforeEach(() => {
    clearStore()
  })

  test("decrements stake on ServiceProvider", () => {
    let initialDeposit = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let withdrawal = BigInt.fromString("400000000000000000000") // 400 GRT
    let remainingStake = initialDeposit.minus(withdrawal)

    // First deposit
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, initialDeposit)
    handleHorizonStakeDeposited(depositEvent)

    // Then withdraw
    let withdrawEvent = createStakeWithdrawnEvent(SP_ADDRESS, withdrawal)
    handleHorizonStakeWithdrawn(withdrawEvent)

    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", remainingStake.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "updatedAtBlock", "200")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "updatedAt", "2000")

    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", remainingStake.toString())
    // Count should remain 1 (we don't decrement on withdraw)
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")
  })

  test("allows full withdrawal", () => {
    let stake = BigInt.fromString("1000000000000000000000") // 1000 GRT

    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stake)
    handleHorizonStakeDeposited(depositEvent)

    let withdrawEvent = createStakeWithdrawnEvent(SP_ADDRESS, stake)
    handleHorizonStakeWithdrawn(withdrawEvent)

    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", "0")
  })

  test("handles multiple withdrawals", () => {
    let initialDeposit = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let withdrawal1 = BigInt.fromString("300000000000000000000") // 300 GRT
    let withdrawal2 = BigInt.fromString("200000000000000000000") // 200 GRT
    let remainingStake = initialDeposit.minus(withdrawal1).minus(withdrawal2)

    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, initialDeposit)
    handleHorizonStakeDeposited(depositEvent)

    let withdrawEvent1 = createStakeWithdrawnEvent(SP_ADDRESS, withdrawal1)
    handleHorizonStakeWithdrawn(withdrawEvent1)

    let withdrawEvent2 = createStakeWithdrawnEvent(SP_ADDRESS, withdrawal2)
    withdrawEvent2.block.number = BigInt.fromI32(300)
    withdrawEvent2.block.timestamp = BigInt.fromI32(3000)
    handleHorizonStakeWithdrawn(withdrawEvent2)

    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", remainingStake.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "updatedAtBlock", "300")
  })
})

describe("Mixed deposit and withdraw scenarios", () => {
  beforeEach(() => {
    clearStore()
  })

  test("handles interleaved deposits and withdrawals", () => {
    // SP1 deposits 1000
    let event1 = createStakeDepositedEvent(SP_ADDRESS, BigInt.fromString("1000000000000000000000"))
    handleHorizonStakeDeposited(event1)

    // SP2 deposits 2000
    let event2 = createStakeDepositedEvent(SP_ADDRESS_2, BigInt.fromString("2000000000000000000000"))
    handleHorizonStakeDeposited(event2)

    // SP1 withdraws 500
    let event3 = createStakeWithdrawnEvent(SP_ADDRESS, BigInt.fromString("500000000000000000000"))
    handleHorizonStakeWithdrawn(event3)

    // SP1 deposits 200
    let event4 = createStakeDepositedEvent(SP_ADDRESS, BigInt.fromString("200000000000000000000"))
    handleHorizonStakeDeposited(event4)

    // Final state: SP1 = 700, SP2 = 2000, Total = 2700
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", "700000000000000000000")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS_2.toHexString(), "tokensStaked", "2000000000000000000000")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensStaked", "2700000000000000000000")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "2")
  })
})
