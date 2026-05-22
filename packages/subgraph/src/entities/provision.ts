import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Provision } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"
import { twoPartId } from "../common/ids"

export function getProvisionId(serviceProvider: Bytes, dataService: Bytes): Bytes {
  return twoPartId(serviceProvider, dataService)
}

export class ProvisionResult {
  entity: Provision
  isNew: boolean

  constructor(entity: Provision, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates a Provision entity.
 * Provisions are created when a service provider provisions stake to a data service.
 */
export function getOrCreateProvision(
  serviceProvider: Bytes,
  dataService: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): ProvisionResult {
  let id = getProvisionId(serviceProvider, dataService)
  let entity = Provision.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new Provision(id)

    // Relationships
    entity.serviceProvider = serviceProvider
    entity.dataService = dataService

    // Tokens
    entity.tokens = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO
    entity.tokensCollected = BIGINT_ZERO
    entity.tokensSlashed = BIGINT_ZERO

    // Parameters
    entity.maxVerifierCut = BIGINT_ZERO
    entity.thawingPeriod = BIGINT_ZERO

    // Staged parameters
    entity.maxVerifierCutPending = BIGINT_ZERO
    entity.thawingPeriodPending = BIGINT_ZERO
    entity.lastParametersStagedAt = BIGINT_ZERO

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new ProvisionResult(entity, isNew)
}

export function saveProvision(provision: Provision, block: ethereum.Block): void {
  provision.updatedAtBlock = block.number
  provision.updatedAt = block.timestamp
  provision.save()
}
