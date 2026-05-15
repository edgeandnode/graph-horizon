import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Provision } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export function getProvisionId(serviceProvider: Bytes, dataService: Bytes): Bytes {
  return serviceProvider.concat(dataService)
}

export class ProvisionResult {
  entity: Provision
  isNew: boolean

  constructor(entity: Provision, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

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
    entity.serviceProvider = serviceProvider
    entity.dataService = dataService
    entity.tokens = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO
    entity.maxVerifierCut = BIGINT_ZERO
    entity.thawingPeriod = BIGINT_ZERO
    entity.maxVerifierCutPending = BIGINT_ZERO
    entity.thawingPeriodPending = BIGINT_ZERO
    entity.lastParametersStagedAt = BIGINT_ZERO
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
