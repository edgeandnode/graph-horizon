import { Bytes } from "@graphprotocol/graph-ts"
import { BIGINT_ZERO } from "../common/constants"
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
import { getOrCreateDataService, saveDataService } from "../entities/dataService"
import { getOrCreateProvision, saveProvision } from "../entities/provision"

/**
 * Emitted when a service provider creates a new provision to a verifier.
 */
export function handleProvisionCreated(event: ProvisionCreated): void {
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let dataService = getOrCreateDataService(
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
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

  // DataService
  dataService.entity.countServiceProviders += 1
  dataService.entity.countProvisions += 1
  dataService.entity.tokensProvisioned = dataService.entity.tokensProvisioned.plus(event.params.tokens)
  saveDataService(dataService.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.countProvisions += 1
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.plus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  if (dataService.entity.countProvisions === 1) {
    graphNetwork.countDataServices += 1
  }
  graphNetwork.countProvisions += 1
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.plus(event.params.tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when tokens are added to an existing provision.
 */
export function handleProvisionIncreased(event: ProvisionIncreased): void {
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let dataService = getOrCreateDataService(
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  let provisionWasActive = provision.entity.tokens.gt(BIGINT_ZERO)
  provision.entity.tokens = provision.entity.tokens.plus(event.params.tokens)
  let provisionIsActive = provision.entity.tokens.gt(BIGINT_ZERO)
  saveProvision(provision.entity, event.block)

  // DataService
  assert(!dataService.isNew, "Data service does not exist.")
  dataService.entity.tokensProvisioned = dataService.entity.tokensProvisioned.plus(event.params.tokens)
  // Increment counters if provision became active
  if (!provisionWasActive && provisionIsActive) {
    dataService.entity.countProvisions += 1
    dataService.entity.countServiceProviders += 1
  }
  saveDataService(dataService.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.plus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  // Increment counter if provision became active
  if (!provisionWasActive && provisionIsActive) {
    serviceProvider.entity.countProvisions += 1
  }
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.plus(event.params.tokens)
  // Increment counters if provision became active
  if (!provisionWasActive && provisionIsActive) {
    graphNetwork.countProvisions += 1
    // Increment data service count if this is the DS's first active provision
    if (dataService.entity.countProvisions == 1) {
      graphNetwork.countDataServices += 1
    }
  }
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when tokens begin thawing from a provision.
 * Note: Thawing tokens are still considered "provisioned".
 */
export function handleProvisionThawed(event: ProvisionThawed): void {
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let dataService = getOrCreateDataService(
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  provision.entity.tokensThawing = provision.entity.tokensThawing.plus(event.params.tokens)
  saveProvision(provision.entity, event.block)

  // DataService
  assert(!dataService.isNew, "Data service does not exist.")
  dataService.entity.tokensThawingFromProvisions = dataService.entity.tokensThawingFromProvisions.plus(event.params.tokens)
  saveDataService(dataService.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  serviceProvider.entity.tokensThawing = serviceProvider.entity.tokensThawing.plus(event.params.tokens)
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  graphNetwork.tokensThawingFromProvisions = graphNetwork.tokensThawingFromProvisions.plus(event.params.tokens)
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when thawed tokens are removed from a provision (after thawing period completes).
 */
export function handleTokensDeprovisioned(event: TokensDeprovisioned): void {
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let dataService = getOrCreateDataService(
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  let provisionWasActive = provision.entity.tokens.gt(BIGINT_ZERO)
  assert(provision.entity.tokens >= event.params.tokens, "Deprovision exceeds provision tokens.")
  provision.entity.tokens = provision.entity.tokens.minus(event.params.tokens)
  assert(provision.entity.tokensThawing >= event.params.tokens, "Deprovision exceeds thawing tokens.")
  provision.entity.tokensThawing = provision.entity.tokensThawing.minus(event.params.tokens)
  let provisionIsActive = provision.entity.tokens.gt(BIGINT_ZERO)
  saveProvision(provision.entity, event.block)

  // DataService
  assert(!dataService.isNew, "Data service does not exist.")
  assert(dataService.entity.tokensThawingFromProvisions >= event.params.tokens, "Deprovision exceeds data service tokens thawing.")
  dataService.entity.tokensThawingFromProvisions = dataService.entity.tokensThawingFromProvisions.minus(event.params.tokens)
  assert(dataService.entity.tokensProvisioned >= event.params.tokens, "Deprovision exceeds data service tokens provisioned.")
  dataService.entity.tokensProvisioned = dataService.entity.tokensProvisioned.minus(event.params.tokens)
  // Decrement counters if provision became inactive
  if (provisionWasActive && !provisionIsActive) {
    assert(dataService.entity.countProvisions > 0, "Data service provision count is zero.")
    dataService.entity.countProvisions -= 1
    assert(dataService.entity.countServiceProviders > 0, "Data service service provider count is zero.")
    dataService.entity.countServiceProviders -= 1
  }
  saveDataService(dataService.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  assert(serviceProvider.entity.tokensThawing >= event.params.tokens, "Deprovision exceeds service provider tokens thawing.")
  serviceProvider.entity.tokensThawing = serviceProvider.entity.tokensThawing.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensProvisioned >= event.params.tokens, "Deprovision exceeds service provider tokens provisioned.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  // Decrement counter if provision became inactive
  if (provisionWasActive && !provisionIsActive) {
    assert(serviceProvider.entity.countProvisions > 0, "Service provider provision count is zero.")
    serviceProvider.entity.countProvisions -= 1
  }
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensThawingFromProvisions >= event.params.tokens, "Deprovision exceeds network tokens thawing from provisions.")
  graphNetwork.tokensThawingFromProvisions = graphNetwork.tokensThawingFromProvisions.minus(event.params.tokens)
  assert(graphNetwork.tokensProvisioned >= event.params.tokens, "Deprovision exceeds network tokens provisioned.")
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.minus(event.params.tokens)
  // Decrement counters if provision became inactive
  if (provisionWasActive && !provisionIsActive) {
    assert(graphNetwork.countProvisions > 0, "Network provision count is zero.")
    graphNetwork.countProvisions -= 1
    // Decrement data service count if this was the DS's last active provision
    if (dataService.entity.countProvisions == 0) {
      assert(graphNetwork.countDataServices > 0, "Network data service count is zero.")
      graphNetwork.countDataServices -= 1
    }
  }
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when a provision is slashed by the verifier.
 */
export function handleProvisionSlashed(event: ProvisionSlashed): void {
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let graphNetwork = getOrCreateGraphNetwork()
  let serviceProvider = getOrCreateServiceProvider(
    event.params.serviceProvider,
    event.block.number,
    event.block.timestamp
  )
  let dataService = getOrCreateDataService(
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )
  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
    event.block.number,
    event.block.timestamp
  )

  // Provision
  assert(!provision.isNew, "Provision does not exist.")
  let provisionWasActive = provision.entity.tokens.gt(BIGINT_ZERO)
  assert(provision.entity.tokens >= event.params.tokens, "Slash exceeds provision tokens")
  provision.entity.tokens = provision.entity.tokens.minus(event.params.tokens)
  provision.entity.tokensSlashed = provision.entity.tokensSlashed.plus(event.params.tokens)
  let provisionIsActive = provision.entity.tokens.gt(BIGINT_ZERO)
  saveProvision(provision.entity, event.block)

  // DataService
  assert(!dataService.isNew, "Data service does not exist.")
  assert(dataService.entity.tokensProvisioned >= event.params.tokens, "Slash exceeds data service tokens provisioned.")
  dataService.entity.tokensProvisioned = dataService.entity.tokensProvisioned.minus(event.params.tokens)
  dataService.entity.countProvisionSlashEvents += 1
  dataService.entity.tokensSlashed = dataService.entity.tokensSlashed.plus(event.params.tokens)
  dataService.entity.tokensSlashedFromProvisions = dataService.entity.tokensSlashedFromProvisions.plus(event.params.tokens)
  // Decrement counters if provision became inactive
  if (provisionWasActive && !provisionIsActive) {
    assert(dataService.entity.countProvisions > 0, "Data service provision count is zero.")
    dataService.entity.countProvisions -= 1
    assert(dataService.entity.countServiceProviders > 0, "Data service service provider count is zero.")
    dataService.entity.countServiceProviders -= 1
  }
  saveDataService(dataService.entity, event.block)

  // ServiceProvider
  assert(!serviceProvider.isNew, "Service provider does not exist.")
  let spWasActive = serviceProvider.entity.tokensStaked.gt(BIGINT_ZERO)
  assert(serviceProvider.entity.tokensStaked >= event.params.tokens, "Slash exceeds service provider tokens staked.")
  serviceProvider.entity.tokensStaked = serviceProvider.entity.tokensStaked.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensProvisioned >= event.params.tokens, "Slash exceeds service provider tokens provisioned.")
  serviceProvider.entity.tokensProvisioned = serviceProvider.entity.tokensProvisioned.minus(event.params.tokens)
  assert(serviceProvider.entity.tokensStaked >= serviceProvider.entity.tokensProvisioned, "Provisioned tokens exceed staked tokens.")
  serviceProvider.entity.tokensIdle = serviceProvider.entity.tokensStaked.minus(serviceProvider.entity.tokensProvisioned)
  serviceProvider.entity.countProvisionSlashEvents += 1
  serviceProvider.entity.tokensSlashed = serviceProvider.entity.tokensSlashed.plus(event.params.tokens)
  serviceProvider.entity.tokensSlashedFromProvisions = serviceProvider.entity.tokensSlashedFromProvisions.plus(event.params.tokens)
  let spIsActive = serviceProvider.entity.tokensStaked.gt(BIGINT_ZERO)
  // Decrement counter if provision became inactive
  if (provisionWasActive && !provisionIsActive) {
    assert(serviceProvider.entity.countProvisions > 0, "Service provider provision count is zero.")
    serviceProvider.entity.countProvisions -= 1
  }
  saveServiceProvider(serviceProvider.entity, event.block)

  // GraphNetwork
  assert(graphNetwork.tokensStaked >= event.params.tokens, "Slash exceeds network tokens staked.")
  assert(graphNetwork.tokensProvisioned >= event.params.tokens, "Slash exceeds network tokens provisioned.")
  graphNetwork.tokensStaked = graphNetwork.tokensStaked.minus(event.params.tokens)
  graphNetwork.tokensProvisioned = graphNetwork.tokensProvisioned.minus(event.params.tokens)
  graphNetwork.countProvisionSlashEvents += 1
  graphNetwork.tokensSlashed = graphNetwork.tokensSlashed.plus(event.params.tokens)
  graphNetwork.tokensSlashedFromProvisions = graphNetwork.tokensSlashedFromProvisions.plus(event.params.tokens)
  // Decrement service provider count if SP became inactive (tokensStaked == 0)
  if (spWasActive && !spIsActive) {
    assert(graphNetwork.countServiceProviders > 0, "Network service provider count is zero.")
    graphNetwork.countServiceProviders -= 1
  }
  // Decrement counters if provision became inactive
  if (provisionWasActive && !provisionIsActive) {
    assert(graphNetwork.countProvisions > 0, "Network provision count is zero.")
    graphNetwork.countProvisions -= 1
    // Decrement data service count if this was the DS's last active provision
    if (dataService.entity.countProvisions == 0) {
      assert(graphNetwork.countDataServices > 0, "Network data service count is zero.")
      graphNetwork.countDataServices -= 1
    }
  }
  saveGraphNetwork(graphNetwork)
}

/**
 * Emitted when new provision parameters are staged (pending acceptance).
 */
export function handleProvisionParametersStaged(event: ProvisionParametersStaged): void {
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
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
  let verifierBytes = Bytes.fromHexString(event.params.verifier.toHexString()) as Bytes

  let provision = getOrCreateProvision(
    event.params.serviceProvider,
    verifierBytes,
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
