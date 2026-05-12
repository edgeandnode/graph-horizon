import { Bytes } from "@graphprotocol/graph-ts"
import {
  TokensDelegated,
  TokensUndelegated,
  DelegatedTokensWithdrawn,
  DelegationSlashed,
} from "../../generated/HorizonStaking/HorizonStaking"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"
import { getOrCreateDelegationPool, saveDelegationPool } from "../entities/delegationPool"

/**
 * Handles TokensDelegated event.
 * Emitted when a delegator delegates tokens to a service provider.
 */
export function handleTokensDelegated(event: TokensDelegated): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let tokens = event.params.tokens
  let shares = event.params.shares

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes

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

  // Update ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.plus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.plus(tokens)
  if (pool.isNew) {
    graphNetwork.countDelegationPools += 1
  }
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles TokensUndelegated event.
 * Emitted when a delegator initiates undelegation (starts thawing).
 */
export function handleTokensUndelegated(event: TokensUndelegated): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let tokens = event.params.tokens
  let shares = event.params.shares

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes

  // Update DelegationPool - shares burned, tokens start thawing
  // Note: sharesThawing not tracked here - it's a calculated value in the contract
  // that differs from the delegation shares being burned
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  pool.entity.shares = pool.entity.shares.minus(shares)
  pool.entity.tokensThawing = pool.entity.tokensThawing.plus(tokens)
  saveDelegationPool(pool.entity, event.block)
}

/**
 * Handles DelegatedTokensWithdrawn event.
 * Emitted when thawed tokens are withdrawn by the delegator.
 */
export function handleDelegatedTokensWithdrawn(event: DelegatedTokensWithdrawn): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let tokens = event.params.tokens

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes

  // Update DelegationPool - tokens leave the pool on withdrawal
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  assert(pool.entity.tokens >= tokens, "Withdraw tokens exceed pool tokens.")
  pool.entity.tokens = pool.entity.tokens.minus(tokens)
  assert(pool.entity.tokensThawing >= tokens, "Withdraw tokens exceed pool thawing tokens.")
  pool.entity.tokensThawing = pool.entity.tokensThawing.minus(tokens)
  saveDelegationPool(pool.entity, event.block)

  // Update ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)
  assert(serviceProvider.entity.tokensDelegated >= tokens, "Withdraw tokens exceed service provider delegated tokens.")
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.minus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  assert(graphNetwork.tokensDelegated >= tokens, "Withdraw tokens exceed network tokens delegated.")
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.minus(tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Handles DelegationSlashed event.
 * Emitted when delegated tokens are slashed from a pool.
 */
export function handleDelegationSlashed(event: DelegationSlashed): void {
  let serviceProviderAddress = event.params.serviceProvider
  let verifier = event.params.verifier
  let tokens = event.params.tokens

  let serviceProviderBytes = Bytes.fromHexString(serviceProviderAddress.toHexString()) as Bytes
  let verifierBytes = Bytes.fromHexString(verifier.toHexString()) as Bytes

  // Update DelegationPool - reduce tokens (slashing affects the pool ratio)
  let pool = getOrCreateDelegationPool(
    serviceProviderBytes,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  assert(pool.entity.tokens >= tokens, "Slash tokens exceed pool tokens.")
  pool.entity.tokens = pool.entity.tokens.minus(tokens)
  saveDelegationPool(pool.entity, event.block)

  // Update ServiceProvider
  let serviceProvider = getOrCreateServiceProvider(serviceProviderBytes, event.block.number, event.block.timestamp)
  assert(serviceProvider.entity.tokensDelegated >= tokens, "Slash tokens exceed service provider delegated tokens.")
  serviceProvider.entity.tokensDelegated = serviceProvider.entity.tokensDelegated.minus(tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // Update GraphNetwork
  let graphNetwork = getOrCreateGraphNetwork()
  assert(graphNetwork.tokensDelegated >= tokens, "Slash tokens exceed network tokens delegated.")
  graphNetwork.tokensDelegated = graphNetwork.tokensDelegated.minus(tokens)
  saveGraphNetwork(graphNetwork)
}
