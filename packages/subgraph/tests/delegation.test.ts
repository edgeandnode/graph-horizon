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
  TokensToDelegationPoolAdded,
  TokensDelegated,
  TokensUndelegated,
  DelegatedTokensWithdrawn,
  DelegationSlashed,
  HorizonStakeDeposited
} from "../generated/HorizonStaking/HorizonStaking"
import {
  handleTokensToDelegationPoolAdded,
  handleTokensDelegated,
  handleTokensUndelegated,
  handleDelegatedTokensWithdrawn,
  handleDelegationSlashed
} from "../src/handlers/delegation"
import { handleHorizonStakeDeposited } from "../src/handlers/staking"
import { GRAPH_NETWORK_ID, BIGINT_ZERO } from "../src/common/constants"
import { getDelegationPoolId } from "../src/entities/delegationPool"
import { DataService, GraphNetwork } from "../generated/schema"

// Test addresses
const SP_ADDRESS = Address.fromString("0x1234567890123456789012345678901234567890")
const VERIFIER_ADDRESS = Address.fromString("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")
const DELEGATOR_ADDRESS = Address.fromString("0x9999999999999999999999999999999999999999")
const DELEGATOR_ADDRESS_2 = Address.fromString("0x8888888888888888888888888888888888888888")

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
  event.block.number = BigInt.fromI32(200)
  event.block.timestamp = BigInt.fromI32(2000)
  return event
}

// Helper to create TokensUndelegated event
function createTokensUndelegatedEvent(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address,
  tokens: BigInt,
  shares: BigInt
): TokensUndelegated {
  let event = newTypedMockEvent<TokensUndelegated>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("delegator", ethereum.Value.fromAddress(delegator)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)))
  event.block.number = BigInt.fromI32(300)
  event.block.timestamp = BigInt.fromI32(3000)
  return event
}

// Helper to create DelegatedTokensWithdrawn event
function createDelegatedTokensWithdrawnEvent(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address,
  tokens: BigInt
): DelegatedTokensWithdrawn {
  let event = newTypedMockEvent<DelegatedTokensWithdrawn>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("delegator", ethereum.Value.fromAddress(delegator)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(400)
  event.block.timestamp = BigInt.fromI32(4000)
  return event
}

// Helper to create DelegationSlashed event
function createDelegationSlashedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt
): DelegationSlashed {
  let event = newTypedMockEvent<DelegationSlashed>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(500)
  event.block.timestamp = BigInt.fromI32(5000)
  return event
}

// Helper to create TokensToDelegationPoolAdded event
function createTokensToDelegationPoolAddedEvent(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt
): TokensToDelegationPoolAdded {
  let event = newTypedMockEvent<TokensToDelegationPoolAdded>()
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam("serviceProvider", ethereum.Value.fromAddress(serviceProvider)))
  event.parameters.push(new ethereum.EventParam("verifier", ethereum.Value.fromAddress(verifier)))
  event.parameters.push(new ethereum.EventParam("tokens", ethereum.Value.fromUnsignedBigInt(tokens)))
  event.block.number = BigInt.fromI32(600)
  event.block.timestamp = BigInt.fromI32(6000)
  return event
}

function getDelegationPoolIdString(sp: Address, verifier: Address): string {
  return getDelegationPoolId(Bytes.fromHexString(sp.toHexString()), Bytes.fromHexString(verifier.toHexString())).toHexString()
}

// Helper to set up DataService entity (normally created via ProvisionCreated)
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
  ds.createdAtBlock = BigInt.fromI32(1)
  ds.createdAt = BigInt.fromI32(100)
  ds.updatedAtBlock = BigInt.fromI32(1)
  ds.updatedAt = BigInt.fromI32(100)
  ds.save()

  // Update GraphNetwork countDataServices
  let graphNetwork = GraphNetwork.load(GRAPH_NETWORK_ID)
  if (graphNetwork != null) {
    graphNetwork.countDataServices += 1
    graphNetwork.save()
  }
}

describe("TokensToDelegationPoolAdded", () => {
  beforeEach(() => {
    clearStore()
  })

  test("adds tokens to pool without minting shares", () => {
    // Setup: deposit stake and delegate
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    let delegatedTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let shares = BigInt.fromString("1000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(delegateEvent)

    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)

    // Add tokens to pool (e.g., rewards)
    let addedTokens = BigInt.fromString("100000000000000000000") // 100 GRT
    let event = createTokensToDelegationPoolAddedEvent(SP_ADDRESS, VERIFIER_ADDRESS, addedTokens)
    handleTokensToDelegationPoolAdded(event)

    let totalTokens = delegatedTokens.plus(addedTokens)

    // Pool: tokens increased, shares unchanged
    assert.fieldEquals("DelegationPool", poolId, "tokens", totalTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "shares", shares.toString())

    // ServiceProvider: tokensDelegated increased
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", totalTokens.toString())

    // GraphNetwork: tokensDelegated increased
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", totalTokens.toString())
  })
})

describe("TokensDelegated", () => {
  beforeEach(() => {
    clearStore()
  })

  test("creates new DelegationPool entity", () => {
    // First deposit stake to create ServiceProvider
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    // Delegate tokens
    let delegatedTokens = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let shares = BigInt.fromString("1000000000000000000000") // 1000 shares (1:1 initially)
    let event = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(event)

    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)

    // Check DelegationPool was created
    assert.entityCount("DelegationPool", 1)
    assert.fieldEquals("DelegationPool", poolId, "tokens", delegatedTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "shares", shares.toString())
    assert.fieldEquals("DelegationPool", poolId, "tokensThawing", "0")
    assert.fieldEquals("DelegationPool", poolId, "createdAtBlock", "200")
    assert.fieldEquals("DelegationPool", poolId, "createdAt", "2000")

    // Check ServiceProvider was updated
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", delegatedTokens.toString())

    // Check GraphNetwork was updated
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countDelegationPools", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", delegatedTokens.toString())
  })

  test("adds to existing DelegationPool on subsequent delegations", () => {
    // Setup
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    // First delegation
    let tokens1 = BigInt.fromString("1000000000000000000000") // 1000 GRT
    let shares1 = BigInt.fromString("1000000000000000000000")
    let event1 = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, tokens1, shares1)
    handleTokensDelegated(event1)

    // Second delegation from different delegator
    let tokens2 = BigInt.fromString("500000000000000000000") // 500 GRT
    let shares2 = BigInt.fromString("500000000000000000000")
    let event2 = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS_2, tokens2, shares2)
    event2.block.number = BigInt.fromI32(250)
    event2.block.timestamp = BigInt.fromI32(2500)
    handleTokensDelegated(event2)

    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    let totalTokens = tokens1.plus(tokens2)
    let totalShares = shares1.plus(shares2)

    // Still only 1 pool (same SP+verifier)
    assert.entityCount("DelegationPool", 1)
    assert.fieldEquals("DelegationPool", poolId, "tokens", totalTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "shares", totalShares.toString())

    // countDelegationPools should still be 1
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countDelegationPools", "1")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", totalTokens.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", totalTokens.toString())
  })
})

describe("TokensUndelegated", () => {
  beforeEach(() => {
    clearStore()
  })

  test("burns shares and starts thawing tokens", () => {
    // Setup: deposit, delegate
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    let delegatedTokens = BigInt.fromString("1000000000000000000000")
    let shares = BigInt.fromString("1000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(delegateEvent)

    // Undelegate half
    let undelegateTokens = BigInt.fromString("500000000000000000000")
    let undelegateShares = BigInt.fromString("500000000000000000000")
    let event = createTokensUndelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, undelegateTokens, undelegateShares)
    handleTokensUndelegated(event)

    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    let remainingShares = shares.minus(undelegateShares)

    // Pool: shares are burned, tokens stay in pool but start thawing
    // tokens stays unchanged until withdrawal
    assert.fieldEquals("DelegationPool", poolId, "tokens", delegatedTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "shares", remainingShares.toString())
    assert.fieldEquals("DelegationPool", poolId, "tokensThawing", undelegateTokens.toString())

    // ServiceProvider: tokensDelegated unchanged (thawing tokens still count as delegated)
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", delegatedTokens.toString())
  })
})

describe("DelegatedTokensWithdrawn", () => {
  beforeEach(() => {
    clearStore()
  })

  test("removes tokens from pool and updates aggregates", () => {
    // Setup: deposit, delegate, undelegate
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    let delegatedTokens = BigInt.fromString("1000000000000000000000")
    let shares = BigInt.fromString("1000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(delegateEvent)

    let undelegateTokens = BigInt.fromString("500000000000000000000")
    let undelegateShares = BigInt.fromString("500000000000000000000")
    let undelegateEvent = createTokensUndelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, undelegateTokens, undelegateShares)
    handleTokensUndelegated(undelegateEvent)

    // At this point: pool.tokens = 1000, tokensThawing = 500 (tokens haven't left yet)
    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    assert.fieldEquals("DelegationPool", poolId, "tokens", delegatedTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "tokensThawing", undelegateTokens.toString())

    // Withdraw after thawing period - tokens now leave the pool
    let event = createDelegatedTokensWithdrawnEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, undelegateTokens)
    handleDelegatedTokensWithdrawn(event)

    let remainingTokens = delegatedTokens.minus(undelegateTokens)

    // Pool: tokens now decremented, tokensThawing cleared
    assert.fieldEquals("DelegationPool", poolId, "tokens", remainingTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "tokensThawing", "0")

    // ServiceProvider: tokensDelegated now decremented
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", remainingTokens.toString())

    // GraphNetwork: tokensDelegated decremented
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", remainingTokens.toString())
  })
})

describe("DelegationSlashed", () => {
  beforeEach(() => {
    clearStore()
  })

  test("reduces pool tokens and aggregates", () => {
    // Setup: deposit, delegate
    let stakeTokens = BigInt.fromString("10000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    let delegatedTokens = BigInt.fromString("1000000000000000000000")
    let shares = BigInt.fromString("1000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(delegateEvent)

    // Slash delegation
    let slashAmount = BigInt.fromString("200000000000000000000") // 200 GRT
    let event = createDelegationSlashedEvent(SP_ADDRESS, VERIFIER_ADDRESS, slashAmount)
    handleDelegationSlashed(event)

    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    let remainingTokens = delegatedTokens.minus(slashAmount)

    // Pool: tokens reduced (shares unchanged - this affects the exchange rate)
    assert.fieldEquals("DelegationPool", poolId, "tokens", remainingTokens.toString())
    assert.fieldEquals("DelegationPool", poolId, "shares", shares.toString())

    // ServiceProvider: tokensDelegated reduced
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", remainingTokens.toString())

    // GraphNetwork: tokensDelegated reduced
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", remainingTokens.toString())
  })
})

describe("Service Provider counter behavior", () => {
  beforeEach(() => {
    clearStore()
  })

  test("does not decrement countServiceProviders when withdrawal leaves SP with stake", () => {
    // Create SP with stake first
    let stakeTokens = BigInt.fromString("5000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    // Then add delegation
    let delegatedTokens = BigInt.fromString("1000000000000000000000")
    let shares = BigInt.fromString("1000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(delegateEvent)

    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")

    // Undelegate and withdraw all
    let undelegateEvent = createTokensUndelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensUndelegated(undelegateEvent)

    let withdrawEvent = createDelegatedTokensWithdrawnEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens)
    handleDelegatedTokensWithdrawn(withdrawEvent)

    // Counter should NOT decrement because SP still has stake
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensStaked", stakeTokens.toString())
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "0")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")
  })

  test("does not double count when delegation is added to existing staked SP", () => {
    // Create SP with stake first
    let stakeTokens = BigInt.fromString("5000000000000000000000")
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")

    // Add delegation - should NOT increment count since SP already exists
    let delegatedTokens = BigInt.fromString("1000000000000000000000")
    let shares = BigInt.fromString("1000000000000000000000")
    let delegateEvent = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, delegatedTokens, shares)
    handleTokensDelegated(delegateEvent)

    // Counter should still be 1
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countServiceProviders", "1")
  })
})

describe("Delegation lifecycle", () => {
  beforeEach(() => {
    clearStore()
  })

  test("tracks delegation correctly through full lifecycle", () => {
    // 1. Deposit stake
    let stakeTokens = BigInt.fromString("10000000000000000000000") // 10000 GRT
    let depositEvent = createStakeDepositedEvent(SP_ADDRESS, stakeTokens)
    handleHorizonStakeDeposited(depositEvent)
    setupDataService(VERIFIER_ADDRESS)

    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "0")

    // 2. First delegation - 1000 GRT
    let tokens1 = BigInt.fromString("1000000000000000000000")
    let shares1 = BigInt.fromString("1000000000000000000000")
    let event1 = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, tokens1, shares1)
    handleTokensDelegated(event1)

    let poolId = getDelegationPoolIdString(SP_ADDRESS, VERIFIER_ADDRESS)
    assert.fieldEquals("DelegationPool", poolId, "tokens", "1000000000000000000000")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "1000000000000000000000")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countDelegationPools", "1")

    // 3. Second delegation - 500 GRT from different delegator
    let tokens2 = BigInt.fromString("500000000000000000000")
    let shares2 = BigInt.fromString("500000000000000000000")
    let event2 = createTokensDelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS_2, tokens2, shares2)
    event2.block.number = BigInt.fromI32(210)
    event2.block.timestamp = BigInt.fromI32(2100)
    handleTokensDelegated(event2)

    assert.fieldEquals("DelegationPool", poolId, "tokens", "1500000000000000000000")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "1500000000000000000000")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "countDelegationPools", "1") // Still 1 pool

    // 4. Undelegate 400 GRT - shares are burned, tokens start thawing
    let undelegateTokens = BigInt.fromString("400000000000000000000")
    let undelegateShares = BigInt.fromString("400000000000000000000")
    let undelegateEvent = createTokensUndelegatedEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, undelegateTokens, undelegateShares)
    handleTokensUndelegated(undelegateEvent)

    // pool.tokens stays at 1500 (tokens haven't left yet), shares reduced to 1100
    assert.fieldEquals("DelegationPool", poolId, "tokens", "1500000000000000000000")
    assert.fieldEquals("DelegationPool", poolId, "shares", "1100000000000000000000")
    assert.fieldEquals("DelegationPool", poolId, "tokensThawing", "400000000000000000000")
    // ServiceProvider still shows full 1500 (thawing still counts)
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "1500000000000000000000")

    // 5. Withdraw after thawing - tokens now leave the pool
    let withdrawEvent = createDelegatedTokensWithdrawnEvent(SP_ADDRESS, VERIFIER_ADDRESS, DELEGATOR_ADDRESS, undelegateTokens)
    handleDelegatedTokensWithdrawn(withdrawEvent)

    // pool.tokens now reduced to 1100
    assert.fieldEquals("DelegationPool", poolId, "tokens", "1100000000000000000000")
    assert.fieldEquals("DelegationPool", poolId, "tokensThawing", "0")
    // Now tokensDelegated decreases
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "1100000000000000000000")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", "1100000000000000000000")

    // 6. Slash 100 GRT
    let slashAmount = BigInt.fromString("100000000000000000000")
    let slashEvent = createDelegationSlashedEvent(SP_ADDRESS, VERIFIER_ADDRESS, slashAmount)
    handleDelegationSlashed(slashEvent)

    assert.fieldEquals("DelegationPool", poolId, "tokens", "1000000000000000000000")
    assert.fieldEquals("ServiceProvider", SP_ADDRESS.toHexString(), "tokensDelegated", "1000000000000000000000")
    assert.fieldEquals("GraphNetwork", GRAPH_NETWORK_ID.toHexString(), "tokensDelegated", "1000000000000000000000")
  })
})
