import {
  ProvisionCreated,
  ProvisionIncreased,
  ProvisionThawed,
  ProvisionSlashed,
  ProvisionParametersStaged,
  ProvisionParametersSet,
  TokensDeprovisioned
} from "../../generated/HorizonStaking/HorizonStaking"
import { getOrCreateGraphNetwork, saveGraphNetwork } from "../entities/graphNetwork"
import { getOrCreateServiceProvider, saveServiceProvider } from "../entities/serviceProvider"
import { getOrCreateProvision, saveProvision } from "../entities/provision"

/**
 * Emitted when a service provider creates a new provision to a verifier.
 */
export function handleProvisionCreated(event: ProvisionCreated): void {
  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(provision.isNew, "Provision already exists.")
  provision.entity.tokens = event.params.tokens
  provision.entity.maxVerifierCut = event.params.maxVerifierCut
  provision.entity.thawingPeriod = event.params.thawingPeriod
  provision.entity.maxVerifierCutPending = event.params.maxVerifierCut
  provision.entity.thawingPeriodPending = event.params.thawingPeriod
  saveProvision(provision.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.plus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  graphNetwork.countProvisions += 1
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.plus(event.params.tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when tokens are added to an existing provision.
 */
export function handleProvisionIncreased(event: ProvisionIncreased): void {
  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  provision.entity.tokens = provision.entity.tokens.plus(event.params.tokens)
  saveProvision(provision.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.plus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.plus(event.params.tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when tokens begin thawing from a provision.
 * Note: Thawing tokens are still considered "provisioned" .
 */
export function handleProvisionThawed(event: ProvisionThawed): void {
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  assert(provision.entity.tokens >= event.params.tokens, "Thaw exceeds provision tokens.")
  provision.entity.tokens = provision.entity.tokens.minus(event.params.tokens)
  provision.entity.tokensThawing = provision.entity.tokensThawing.plus(event.params.tokens)
  saveProvision(provision.entity, event.block)
}

/**
 * Emitted when thawed tokens are removed from a provision (after thawing period completes).
 */
export function handleTokensDeprovisioned(event: TokensDeprovisioned): void {
  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  assert(provision.entity.tokensThawing >= event.params.tokens, "Deprovision exceeds thawing tokens.")
  provision.entity.tokensThawing = provision.entity.tokensThawing.minus(event.params.tokens)
  saveProvision(provision.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  assert(serviceProvider.entity.tokensProvisioned >= event.params.tokens, "Deprovision exceeds service provider tokens provisioned.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensProvisioned >= event.params.tokens, "Deprovision exceeds network tokens provisioned.")
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.minus(event.params.tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when a provision is slashed by the verifier.
 */
export function handleProvisionSlashed(event: ProvisionSlashed): void {
  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  assert(provision.entity.tokens >= event.params.tokens, "Slash exceeds provision tokens")
  provision.entity.tokens = provision.entity.tokens.minus(event.params.tokens)
  saveProvision(provision.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  assert(serviceProvider.entity.tokensStaked >= event.params.tokens, "Slash exceeds service provider tokens staked.")
  serviceProvider.entity.tokensStaked = serviceProvider.entity.tokensStaked.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensProvisioned >= event.params.tokens, "Slash exceeds service provider tokens provisioned.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensStaked >= event.params.tokens, "Slash exceeds network tokens staked.")
  assert(graphNetwork.tokensProvisioned >= event.params.tokens, "Slash exceeds network tokens provisioned.")
  graphNetwork.tokensStaked = graphNetwork.tokensStaked.minus(event.params.tokens)
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.minus(event.params.tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when new provision parameters are staged (pending acceptance).
 */
export function handleProvisionParametersStaged(event: ProvisionParametersStaged): void {
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  provision.entity.maxVerifierCutPending = event.params.maxVerifierCut
  provision.entity.thawingPeriodPending = event.params.thawingPeriod
  provision.entity.lastParametersStagedAt = event.block.timestamp
  saveProvision(provision.entity, event.block)
}

/**
 * Emitted when staged provision parameters are accepted.
 */
export function handleProvisionParametersSet(event: ProvisionParametersSet): void {
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    event.params.verifier,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  provision.entity.maxVerifierCut = event.params.maxVerifierCut
  provision.entity.thawingPeriod = event.params.thawingPeriod
  provision.entity.maxVerifierCutPending = event.params.maxVerifierCut
  provision.entity.thawingPeriodPending = event.params.thawingPeriod
  saveProvision(provision.entity, event.block)
}
