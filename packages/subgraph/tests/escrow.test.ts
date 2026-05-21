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
  Deposit,
  Thaw,
  CancelThaw,
  Withdraw,
  EscrowCollected,
} from "../generated/PaymentsEscrow/PaymentsEscrow"
import {
  handleDeposit,
  handleThaw,
  handleCancelThaw,
  handleWithdraw,
  handleEscrowCollected,
} from "../src/handlers/escrow"
import { GRAPH_NETWORK_ID } from "../src/common/constants"
import { getEscrowAccountId } from "../src/entities/escrowAccount"

// Test addresses
const PAYER_ADDRESS = Address.fromString("0x1111111111111111111111111111111111111111")
const PAYER_ADDRESS_2 = Address.fromString("0x2222222222222222222222222222222222222222")
const COLLECTOR_ADDRESS = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
const RECEIVER_ADDRESS = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
const RECEIVER_ADDRESS_2 = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc")

// Payment type (for EscrowCollected)
const PAYMENT_TYPE_QUERY_FEE = 0

// Helper to create Deposit event
function createDepositEvent(
  payer: Address,
  collector: Address,
  receiver: Address,
  tokens: BigInt
): Deposit {
  let event = newTypedMockEvent<Deposit>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)))
  event.parameters.push(new ethereum.EventParam("collector", ethereum.Value.fromAddress(collector)))
  event.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(100)
  event.block.timestamp = BigInt.fromI32(1000)
  return event
}

// Helper to create Thaw event
function createThawEvent(
  payer: Address,
  collector: Address,
  receiver: Address,
  tokens: BigInt,
  thawEndTimestamp: BigInt
): Thaw {
  let event = newTypedMockEvent<Thaw>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)))
  event.parameters.push(new ethereum.EventParam("collector", ethereum.Value.fromAddress(collector)))
  event.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("thawEndTimestamp", ethereum.Value.fromUnsignedBigInt(thawEndTimestamp)))
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)
  return event
}

// Helper to create CancelThaw event
function createCancelThawEvent(
  payer: Address,
  collector: Address,
  receiver: Address,
  tokensThawing: BigInt,
  thawEndTimestamp: BigInt
): CancelThaw {
  let event = newTypedMockEvent<CancelThaw>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)))
  event.parameters.push(new ethereum.EventParam("collector", ethereum.Value.fromAddress(collector)))
  event.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  event.parameters.push(new ethereum.EventParam("tokensThawing", ethereum.Value.fromUnsignedBigInt(tokensThawing)))
  event.parameters.push(new ethereum.EventParam("thawEndTimestamp", ethereum.Value.fromUnsignedBigInt(thawEndTimestamp)))
  event.block.number = BigInt.fromI32(300)
  event.block.timestamp = BigInt.fromI32(3000)
  return event
}

// Helper to create Withdraw event
function createWithdrawEvent(
  payer: Address,
  collector: Address,
  receiver: Address,
  tokens: BigInt
): Withdraw {
  let event = newTypedMockEvent<Withdraw>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)))
  event.parameters.push(new ethereum.EventParam("collector", ethereum.Value.fromAddress(collector)))
  event.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(400)
  event.block.timestamp = BigInt.fromI32(4000)
  return event
}

// Helper to create EscrowCollected event
function createEscrowCollectedEvent(
  paymentType: i32,
  payer: Address,
  collector: Address,
  receiver: Address,
  tokens: BigInt,
  receiverDestination: Address
): EscrowCollected {
  let event = newTypedMockEvent<EscrowCollected>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("paymentType", ethereum.Value.fromI32(paymentType)))
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)))
  event.parameters.push(new ethereum.EventParam("collector", ethereum.Value.fromAddress(collector)))
  event.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("receiverDestination", ethereum.Value.fromAddress(receiverDestination)))
  event.block.number = BigInt.fromI32(500)
  event.block.timestamp = BigInt.fromI32(5000)
  return event
}

function getEscrowAccountIdString(payer: Address, collector: Address, receiver: Address): string {
  return getEscrowAccountId(
    Bytes.fromHexString(payer.toHexString()),
    Bytes.fromHexString(collector.toHexString()),
    Bytes.fromHexString(receiver.toHexString())
  ).toHexString()
}

describe("handleDeposit", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates Payer, Collector, ServiceProvider, and EscrowAccount on first deposit", () => {
    let tokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let event = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, tokens)
    handleDeposit(event)

    // Check Payer was created
    assert.entityCount("Payer", 1)
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensEscrowed", tokens.toString())
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensThawing", "0")
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensCollected", "0")
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "countEscrowAccounts", "1")

    // Check Collector was created
    assert.entityCount("Collector", 1)
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensEscrowed", tokens.toString())
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensThawing", "0")
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensCollected", "0")
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "countEscrowAccounts", "1")

    // Check ServiceProvider was created
    assert.entityCount("ServiceProvider", 1)
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensEscrowed", tokens.toString())
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "countEscrowAccounts", "1")

    // Check EscrowAccount was created
    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)
    assert.entityCount("EscrowAccount", 1)
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", tokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", "0")
    assert.fieldEquals("EscrowAccount", escrowId, "tokensCollected", "0")

    // Check GraphNetwork was updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countPayers", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countCollectors", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countEscrowAccounts", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", tokens.toString())
  })

  test("adds to existing escrow account on subsequent deposit", () => {
    let tokens1 = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let event1 = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, tokens1)
    handleDeposit(event1)

    let tokens2 = BigInt.fromString("500000000000000000000") // 500 GRT
    let event2 = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, tokens2)
    event2.block.number = BigInt.fromI32(150)
    event2.block.timestamp = BigInt.fromI32(1500)
    handleDeposit(event2)

    let totalTokens = tokens1.plus(tokens2)
    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)

    // Only 1 escrow account should exist
    assert.entityCount("EscrowAccount", 1)
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", totalTokens.toString())

    // Payer/Collector/SP should have updated totals but same count
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensEscrowed", totalTokens.toString())
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "countEscrowAccounts", "1")

    // GraphNetwork should have same counts
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countEscrowAccounts", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", totalTokens.toString())
  })

  test("creates separate escrow accounts for different receivers", () => {
    let tokens = BigInt.fromString("1000000000000000000000") // 1000 GRT

    let event1 = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, tokens)
    handleDeposit(event1)

    let event2 = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS_2, tokens)
    event2.block.number = BigInt.fromI32(150)
    event2.block.timestamp = BigInt.fromI32(1500)
    handleDeposit(event2)

    // 2 escrow accounts should exist
    assert.entityCount("EscrowAccount", 2)

    // 2 service providers
    assert.entityCount("ServiceProvider", 2)

    // Payer should have 2 escrow accounts
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "countEscrowAccounts", "2")

    // GraphNetwork
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countEscrowAccounts", "2")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "2")
  })
})

describe("handleThaw", () => {
  beforeEach(() => {
    clearStore()
  })

  test("moves tokens from available to thawing state", () => {
    // First deposit
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    // Thaw half
    let thawTokens = BigInt.fromString("500000000000000000000") // 500 GRT
    let thawEndTimestamp = BigInt.fromI32(2000 + 86400) // 1 day later
    let thawEvent = createThawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens, thawEndTimestamp)
    handleThaw(thawEvent)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)
    let remainingTokens = depositTokens.minus(thawTokens)

    // EscrowAccount: tokens moved to thawing
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", remainingTokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", thawTokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "thawEndTimestamp", thawEndTimestamp.toString())

    // Payer: tokensThawing updated
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensThawing", thawTokens.toString())

    // Collector: tokensThawing updated
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensThawing", thawTokens.toString())

    // GraphNetwork: tokensThawingFromEscrow updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensThawingFromEscrow", thawTokens.toString())
  })
})

describe("handleCancelThaw", () => {
  beforeEach(() => {
    clearStore()
  })

  test("moves tokens back from thawing to available state", () => {
    // Deposit
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    // Thaw
    let thawTokens = BigInt.fromString("500000000000000000000") // 500 GRT
    let thawEndTimestamp = BigInt.fromI32(2000 + 86400)
    let thawEvent = createThawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens, thawEndTimestamp)
    handleThaw(thawEvent)

    // Cancel thaw
    let cancelEvent = createCancelThawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens, BigInt.zero())
    handleCancelThaw(cancelEvent)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)

    // EscrowAccount: tokens back to available
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", depositTokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", "0")
    assert.fieldEquals("EscrowAccount", escrowId, "thawEndTimestamp", "0")

    // Payer: tokensThawing back to zero
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensThawing", "0")

    // Collector: tokensThawing back to zero
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensThawing", "0")

    // GraphNetwork: tokensThawingFromEscrow back to zero
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensThawingFromEscrow", "0")
  })
})

describe("handleWithdraw", () => {
  beforeEach(() => {
    clearStore()
  })

  test("removes thawed tokens from escrow", () => {
    // Deposit
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    // Thaw all
    let thawEndTimestamp = BigInt.fromI32(2000 + 86400)
    let thawEvent = createThawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens, thawEndTimestamp)
    handleThaw(thawEvent)

    // Withdraw
    let withdrawEvent = createWithdrawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleWithdraw(withdrawEvent)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)

    // EscrowAccount: tokensThawing should be zero
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", "0")
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", "0")

    // Payer: tokensEscrowed and tokensThawing reduced
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensEscrowed", "0")
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensThawing", "0")

    // Collector: tokensEscrowed and tokensThawing reduced
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensEscrowed", "0")
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensThawing", "0")

    // ServiceProvider: tokensEscrowed reduced
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensEscrowed", "0")

    // GraphNetwork: tokensEscrowed and tokensThawingFromEscrow reduced
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensThawingFromEscrow", "0")
  })

  test("partial withdrawal leaves remaining tokens in escrow", () => {
    // Deposit
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    // Thaw half
    let thawTokens = BigInt.fromString("500000000000000000000") // 500 GRT
    let thawEndTimestamp = BigInt.fromI32(2000 + 86400)
    let thawEvent = createThawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens, thawEndTimestamp)
    handleThaw(thawEvent)

    // Withdraw thawed portion
    let withdrawEvent = createWithdrawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens)
    handleWithdraw(withdrawEvent)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)
    let remainingTokens = depositTokens.minus(thawTokens)

    // EscrowAccount: remaining tokens still available
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", remainingTokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", "0")

    // Payer: still has remaining escrow
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensEscrowed", remainingTokens.toString())

    // GraphNetwork: still has remaining escrow
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", remainingTokens.toString())
  })
})

describe("handleEscrowCollected", () => {
  beforeEach(() => {
    clearStore()
  })

  test("reduces available tokens and tracks collection", () => {
    // Deposit
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    // Collect payment
    let collectTokens = BigInt.fromString("300000000000000000000") // 300 GRT
    let collectEvent = createEscrowCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      COLLECTOR_ADDRESS,
      RECEIVER_ADDRESS,
      collectTokens,
      RECEIVER_ADDRESS
    )
    handleEscrowCollected(collectEvent)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)
    let remainingTokens = depositTokens.minus(collectTokens)

    // EscrowAccount: tokens reduced, tokensCollected increased
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", remainingTokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensCollected", collectTokens.toString())

    // Payer: tokensEscrowed reduced, tokensCollected increased
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensEscrowed", remainingTokens.toString())
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensCollected", collectTokens.toString())

    // Collector: tokensEscrowed reduced, tokensCollected increased
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensEscrowed", remainingTokens.toString())
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensCollected", collectTokens.toString())

    // ServiceProvider: tokensEscrowed reduced
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensEscrowed", remainingTokens.toString())

    // GraphNetwork: tokensEscrowed reduced
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", remainingTokens.toString())
  })

  test("multiple collections accumulate tokensCollected", () => {
    // Deposit
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    // First collection
    let collect1 = BigInt.fromString("100000000000000000000") // 100 GRT
    let collectEvent1 = createEscrowCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      COLLECTOR_ADDRESS,
      RECEIVER_ADDRESS,
      collect1,
      RECEIVER_ADDRESS
    )
    handleEscrowCollected(collectEvent1)

    // Second collection
    let collect2 = BigInt.fromString("200000000000000000000") // 200 GRT
    let collectEvent2 = createEscrowCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      COLLECTOR_ADDRESS,
      RECEIVER_ADDRESS,
      collect2,
      RECEIVER_ADDRESS
    )
    collectEvent2.block.number = BigInt.fromI32(550)
    collectEvent2.block.timestamp = BigInt.fromI32(5500)
    handleEscrowCollected(collectEvent2)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)
    let totalCollected = collect1.plus(collect2)
    let remainingTokens = depositTokens.minus(totalCollected)

    // Check accumulated values
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", remainingTokens.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensCollected", totalCollected.toString())
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensCollected", totalCollected.toString())
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensCollected", totalCollected.toString())
  })
})

describe("Escrow lifecycle", () => {
  beforeEach(() => {
    clearStore()
  })

  test("tracks escrow through full lifecycle: deposit -> collect -> thaw -> withdraw", () => {
    let depositTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT

    // 1. Deposit
    let depositEvent = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, depositTokens)
    handleDeposit(depositEvent)

    let escrowId = getEscrowAccountIdString(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS)
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", depositTokens.toString())

    // 2. Collect 300 GRT for services
    let collectTokens = BigInt.fromString("300000000000000000000")
    let collectEvent = createEscrowCollectedEvent(
      PAYMENT_TYPE_QUERY_FEE,
      PAYER_ADDRESS,
      COLLECTOR_ADDRESS,
      RECEIVER_ADDRESS,
      collectTokens,
      RECEIVER_ADDRESS
    )
    handleEscrowCollected(collectEvent)

    let afterCollect = depositTokens.minus(collectTokens)
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", afterCollect.toString())
    assert.fieldEquals("EscrowAccount", escrowId, "tokensCollected", collectTokens.toString())

    // 3. Thaw remaining 700 GRT
    let thawTokens = afterCollect // 700 GRT
    let thawEndTimestamp = BigInt.fromI32(6000)
    let thawEvent = createThawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens, thawEndTimestamp)
    thawEvent.block.number = BigInt.fromI32(600)
    thawEvent.block.timestamp = BigInt.fromI32(6000)
    handleThaw(thawEvent)

    assert.fieldEquals("EscrowAccount", escrowId, "tokens", "0")
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", thawTokens.toString())

    // 4. Withdraw after thawing
    let withdrawEvent = createWithdrawEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, thawTokens)
    handleWithdraw(withdrawEvent)

    // Final state: all tokens either collected or withdrawn
    assert.fieldEquals("EscrowAccount", escrowId, "tokens", "0")
    assert.fieldEquals("EscrowAccount", escrowId, "tokensThawing", "0")
    assert.fieldEquals("EscrowAccount", escrowId, "tokensCollected", collectTokens.toString())

    // Payer totals
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensEscrowed", "0")
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensThawing", "0")
    assert.fieldEquals("Payer", PAYER_ADDRESS.toHexString(), "tokensCollected", collectTokens.toString())

    // GraphNetwork totals
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensThawingFromEscrow", "0")
  })

  test("multiple payers can deposit to same collector/receiver", () => {
    let tokens = BigInt.fromString("1000000000000000000000") // 1000 GRT

    // Payer 1 deposits
    let event1 = createDepositEvent(PAYER_ADDRESS, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, tokens)
    handleDeposit(event1)

    // Payer 2 deposits
    let event2 = createDepositEvent(PAYER_ADDRESS_2, COLLECTOR_ADDRESS, RECEIVER_ADDRESS, tokens)
    event2.block.number = BigInt.fromI32(150)
    event2.block.timestamp = BigInt.fromI32(1500)
    handleDeposit(event2)

    // 2 escrow accounts, 2 payers, 1 collector, 1 service provider
    assert.entityCount("EscrowAccount", 2)
    assert.entityCount("Payer", 2)
    assert.entityCount("Collector", 1)
    assert.entityCount("ServiceProvider", 1)

    // Collector has 2 escrow accounts with total 2000 GRT
    let totalTokens = tokens.plus(tokens)
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "countEscrowAccounts", "2")
    assert.fieldEquals("Collector", COLLECTOR_ADDRESS.toHexString(), "tokensEscrowed", totalTokens.toString())

    // ServiceProvider has 2 escrow accounts with total 2000 GRT
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "countEscrowAccounts", "2")
    assert.fieldEquals("ServiceProvider", RECEIVER_ADDRESS.toHexString(), "tokensEscrowed", totalTokens.toString())

    // GraphNetwork totals
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countPayers", "2")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countCollectors", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countEscrowAccounts", "2")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensEscrowed", totalTokens.toString())
  })
})
