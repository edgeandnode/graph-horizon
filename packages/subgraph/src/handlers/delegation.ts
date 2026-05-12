import { Address, Bytes, BigInt, log } from "@graphprotocol/graph-ts"
import {
  TokensDelegated,
  TokensUndelegated,
  DelegatedTokensWithdrawn,
  DelegationSlashed,
  HorizonStaking,
} from "../../generated/HorizonStaking/HorizonStaking"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"
import { getOrCreateDelegationPool, saveDelegationPool } from "../entities/delegationPool"
import { getOrCreateDelegator, saveDelegator } from "../entities/delegator"
import { getOrCreateDelegation, saveDelegation } from "../entities/delegation"
import { config } from "../config"

/**
 * Handles TokensDelegated event.
 * Emitted when a delegator delegates tokens to a service provider.
 */
export function handleTokensDelegated(event: TokensDelegated): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let delegatorAddress = event.params.delegator
  let tokens = event.params.tokens
  let shares = event.params.shares

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes
  let delegatorBytes = Bytes.fromHexString(delegatorAddress.toHexString()) as Bytes

  // Update DelegationPool
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  pool.entity.tokens = pool.entity.tokens.plus(tokens)
  pool.entity.shares = pool.entity.shares.plus(shares)
  saveDelegationPool(pool.entity, event.block)

  // Update Delegator
  let delegator = getOrCreateDelegator(delegatorBytes, event.block.number, event.block.timestamp)
  delegator.entity.tokensDelegated = delegator.entity.tokensDelegated.plus(tokens)
  saveDelegator(delegator.entity, event.block)

  // Update Delegation
  let delegation = getOrCreateDelegation(
    delegatorBytes,
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  delegation.entity.shares = delegation.entity.shares.plus(shares)
  saveDelegation(delegation.entity, event.block)

  // Update pool and delegator counts if new delegation
  if (delegation.isNew) {
    delegator.entity.countDelegations += 1
    saveDelegator(delegator.entity, event.block)

    pool.entity.countDelegators += 1
    saveDelegationPool(pool.entity, event.block)
  }

  // Update ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.plus(tokens)
  if (delegation.isNew) {
    serviceProvider.entity.countDelegators += 1
  }
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.plus(tokens)
  if (pool.isNew) {
    graphNetwork.countDelegationPools += 1
  }
  if (delegator.isNew) {
    graphNetwork.countDelegators += 1
  }
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles TokensUndelegated event.
 * Emitted when a delegator initiates undelegation (starts thawing).
 *
 * Supports lazy initialization for legacy delegators not seeded at genesis.
 * When entities are new, getOrCreate fetches current state from contract,
 * so we skip applying the delta (contract already applied it).
 */
export function handleTokensUndelegated(event: TokensUndelegated): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let delegatorAddress = event.params.delegator
  let tokens = event.params.tokens
  let shares = event.params.shares

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes
  let delegatorBytes = Bytes.fromHexString(delegatorAddress.toHexString()) as Bytes

  // Get or lazy-init DelegationPool (fetches from contract if new)
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  if (pool.isNew) {
    // Lazy-inited: update count, but skip delta (contract state is current)
    let graphNetwork = getOrCreateGraphNetwork()
    graphNetwork.countDelegationPools += 1
    saveGraphNetwork(graphNetwork)
  } else {
    // Existing pool: apply event delta
    pool.entity.tokens = pool.entity.tokens.minus(tokens)
    pool.entity.shares = pool.entity.shares.minus(shares)
    pool.entity.tokensThawing = pool.entity.tokensThawing.plus(tokens)
    pool.entity.sharesThawing = pool.entity.sharesThawing.plus(shares)
  }
  saveDelegationPool(pool.entity, event.block)

  // Get or lazy-init Delegation (fetches from contract if new)
  let delegation = getOrCreateDelegation(
    delegatorBytes,
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  if (delegation.isNew) {
    // Lazy-inited: update counts for newly discovered delegation
    pool.entity.countDelegators += 1
    saveDelegationPool(pool.entity, event.block)

    let delegator = getOrCreateDelegator(delegatorBytes, event.block.number, event.block.timestamp)
    if (delegator.isNew) {
      let graphNetwork = getOrCreateGraphNetwork()
      graphNetwork.countDelegators += 1
      saveGraphNetwork(graphNetwork)
    }
    delegator.entity.countDelegations += 1
    saveDelegator(delegator.entity, event.block)

    let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)
    serviceProvider.entity.countDelegators += 1
    saveServiceProvider(serviceProvider.entity, event.block)
  } else {
    // Existing delegation: apply event delta
    delegation.entity.shares = delegation.entity.shares.minus(shares)
  }
  saveDelegation(delegation.entity, event.block)
}

/**
 * Handles DelegatedTokensWithdrawn event.
 * Emitted when thawed tokens are withdrawn by the delegator.
 *
 * Supports lazy initialization for legacy delegators not seeded at genesis.
 * When entities are new, getOrCreate fetches current state from contract,
 * so we skip applying the delta (contract already applied it).
 */
export function handleDelegatedTokensWithdrawn(event: DelegatedTokensWithdrawn): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let delegatorAddress = event.params.delegator
  let tokens = event.params.tokens

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes
  let delegatorBytes = Bytes.fromHexString(delegatorAddress.toHexString()) as Bytes

  // Get or lazy-init DelegationPool (fetches from contract if new)
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  if (pool.isNew) {
    let graphNetwork = getOrCreateGraphNetwork()
    graphNetwork.countDelegationPools += 1
    saveGraphNetwork(graphNetwork)
  } else {
    // Existing pool: apply event delta
    pool.entity.tokensThawing = pool.entity.tokensThawing.minus(tokens)
  }
  saveDelegationPool(pool.entity, event.block)

  // Get or lazy-init Delegator
  // Note: Delegator tokensDelegated cannot be lazy-inited from contract (no single call)
  // For lazy-inited delegators, tokensDelegated starts at 0 which may be inaccurate
  let delegator = getOrCreateDelegator(delegatorBytes, event.block.number, event.block.timestamp)

  if (delegator.isNew) {
    let graphNetwork = getOrCreateGraphNetwork()
    graphNetwork.countDelegators += 1
    saveGraphNetwork(graphNetwork)
  }
  // Always apply delta for delegator (we can't fetch aggregate from contract)
  delegator.entity.tokensDelegated = delegator.entity.tokensDelegated.minus(tokens)
  saveDelegator(delegator.entity, event.block)

  // Get or lazy-init ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)

  if (serviceProvider.isNew) {
    // Fetch stake from contract
    let horizonStaking = HorizonStaking.bind(config.horizonStakingAddress)
    serviceProvider.entity.tokensStaked = horizonStaking.getStake(serviceProviderAddress)

    let graphNetwork = getOrCreateGraphNetwork()
    graphNetwork.countServiceProviders += 1
    graphNetwork.tokensStaked = graphNetwork.tokensStaked.plus(serviceProvider.entity.tokensStaked)
    saveGraphNetwork(graphNetwork)
  }
  // Always apply delta for serviceProvider tokensDelegated
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.minus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Get or lazy-init Delegation (fetches from contract if new)
  let delegation = getOrCreateDelegation(
    delegatorBytes,
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  if (delegation.isNew) {
    // Update counts for newly discovered delegation
    pool.entity.countDelegators += 1
    saveDelegationPool(pool.entity, event.block)

    delegator.entity.countDelegations += 1
    saveDelegator(delegator.entity, event.block)

    serviceProvider.entity.countDelegators += 1
    saveServiceProvider(serviceProvider.entity, event.block)
  }

  // Check if delegation has no more shares (fully undelegated)
  if (delegation.entity.shares.isZero()) {
    delegator.entity.countDelegations -= 1
    saveDelegator(delegator.entity, event.block)

    pool.entity.countDelegators -= 1
    saveDelegationPool(pool.entity, event.block)

    serviceProvider.entity.countDelegators -= 1
    saveServiceProvider(serviceProvider.entity, event.block)
  }

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.minus(tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles DelegationSlashed event.
 * Emitted when delegated tokens are slashed from a pool.
 *
 * Supports lazy initialization for legacy delegation pools not seeded at genesis.
 * When entities are new, getOrCreate fetches current state from contract,
 * so we skip applying the delta (contract already applied it).
 */
export function handleDelegationSlashed(event: DelegationSlashed): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let tokens = event.params.tokens

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes

  // Get or lazy-init DelegationPool (fetches from contract if new)
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  if (pool.isNew) {
    let graphNetwork = getOrCreateGraphNetwork()
    graphNetwork.countDelegationPools += 1
    saveGraphNetwork(graphNetwork)
  } else {
    // Existing pool: apply event delta
    pool.entity.tokens = pool.entity.tokens.minus(tokens)
  }
  saveDelegationPool(pool.entity, event.block)

  // Get or lazy-init ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)

  if (serviceProvider.isNew) {
    // Fetch stake from contract
    let horizonStaking = HorizonStaking.bind(config.horizonStakingAddress)
    serviceProvider.entity.tokensStaked = horizonStaking.getStake(serviceProviderAddress)

    let graphNetwork = getOrCreateGraphNetwork()
    graphNetwork.countServiceProviders += 1
    graphNetwork.tokensStaked = graphNetwork.tokensStaked.plus(serviceProvider.entity.tokensStaked)
    saveGraphNetwork(graphNetwork)
  }
  // Always apply delta for serviceProvider tokensDelegated
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.minus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.minus(tokens)
  saveGraphNetwork(graphNetwork)
}
