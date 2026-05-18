import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { ProvisionThawRequest } from "../../generated/schema"
import { getProvisionId } from "./provision"

export class ProvisionThawRequestResult {
  entity: ProvisionThawRequest
  isNew: boolean

  constructor(entity: ProvisionThawRequest, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getOrCreateProvisionThawRequest(
  id: Bytes,
  serviceProvider: Bytes,
  dataService: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): ProvisionThawRequestResult {
  let entity = ProvisionThawRequest.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new ProvisionThawRequest(id)
    entity.provision = getProvisionId(serviceProvider, dataService)
    entity.serviceProvider = serviceProvider
    entity.dataService = dataService
    entity.shares = BigInt.zero()
    entity.thawingUntil = BigInt.zero()
    entity.thawingNonce = BigInt.zero()
    entity.tokensWithdrawn = null
    entity.valid = true
    entity.fulfilled = false
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new ProvisionThawRequestResult(entity, isNew)
}

export function saveProvisionThawRequest(
  thawRequest: ProvisionThawRequest,
  block: ethereum.Block
): void {
  thawRequest.updatedAtBlock = block.number
  thawRequest.updatedAt = block.timestamp
  thawRequest.save()
}
