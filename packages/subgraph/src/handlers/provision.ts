import {
  ProvisionCreated,
  ProvisionIncreased,
  ProvisionThawed,
  ProvisionSlashed,
  ProvisionParametersStaged,
  ProvisionParametersSet
} from "../../generated/HorizonStaking/HorizonStaking"
import {
  getOrCreateGraphNetwork,
  updateGraphNetworkOnProvisionCreated,
  updateGraphNetworkOnProvisionIncreased,
  updateGraphNetworkOnProvisionThawed,
  updateGraphNetworkOnProvisionSlashed
} from "../entities/graphNetwork"
import {
  getOrCreateServiceProvider,
  updateServiceProviderOnProvisionCreated,
  updateServiceProviderOnProvisionIncreased,
  updateServiceProviderOnProvisionThawed,
  updateServiceProviderOnProvisionSlashed
} from "../entities/serviceProvider"
import {
  getOrCreateProvision,
  updateProvisionOnCreated,
  updateProvisionOnIncreased,
  updateProvisionOnThawed,
  updateProvisionOnSlashed,
  updateProvisionOnParametersStaged,
  updateProvisionOnParametersSet
} from "../entities/provision"

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
  updateProvisionOnCreated(
    provision.entity,
    event.params.tokens,
    event.params.maxVerifierCut,
    event.params.thawingPeriod,
    event.block.number,
    event.block.timestamp
  )
  provision.entity.save()

  // Service provider
  updateServiceProviderOnProvisionCreated(
    serviceProvider.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  serviceProvider.entity.save()

  // Graph network
  updateGraphNetworkOnProvisionCreated(graphNetwork, event.params.tokens)
  graphNetwork.save()
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
  updateProvisionOnIncreased(
    provision.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  provision.entity.save()

  // Service provider
  updateServiceProviderOnProvisionIncreased(
    serviceProvider.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  serviceProvider.entity.save()

  // Graph network
  updateGraphNetworkOnProvisionIncreased(graphNetwork, event.params.tokens)
  graphNetwork.save()
}

/**
 * Emitted when tokens begin thawing from a provision.
 */
export function handleProvisionThawed(event: ProvisionThawed): void {
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
  updateProvisionOnThawed(
    provision.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  provision.entity.save()

  // Service provider
  updateServiceProviderOnProvisionThawed(
    serviceProvider.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  serviceProvider.entity.save()

  // Graph network
  updateGraphNetworkOnProvisionThawed(graphNetwork, event.params.tokens)
  graphNetwork.save()
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
  updateProvisionOnSlashed(
    provision.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  provision.entity.save()

  // Service provider
  updateServiceProviderOnProvisionSlashed(
    serviceProvider.entity,
    event.params.tokens,
    event.block.number,
    event.block.timestamp
  )
  serviceProvider.entity.save()

  // Graph network
  updateGraphNetworkOnProvisionSlashed(graphNetwork, event.params.tokens)
  graphNetwork.save()
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

  updateProvisionOnParametersStaged(
    provision.entity,
    event.params.maxVerifierCut,
    event.params.thawingPeriod,
    event.block.number,
    event.block.timestamp
  )
  provision.entity.save()
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

  updateProvisionOnParametersSet(
    provision.entity,
    event.params.maxVerifierCut,
    event.params.thawingPeriod,
    event.block.number,
    event.block.timestamp
  )
  provision.entity.save()
}
