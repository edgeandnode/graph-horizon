import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { ServiceProvider } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class ServiceProviderResult {
  entity: ServiceProvider
  isNew: boolean

  constructor(entity: ServiceProvider, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getOrCreateServiceProvider(
  id: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): ServiceProviderResult {
  let entity = ServiceProvider.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new ServiceProvider(id)
    entity.tokensStaked = BIGINT_ZERO
    entity.tokensProvisioned = BIGINT_ZERO
    entity.tokensIdle = BIGINT_ZERO
    entity.tokensDelegated = BIGINT_ZERO
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new ServiceProviderResult(entity, isNew)
}

export function saveServiceProvider(sp: ServiceProvider, block: ethereum.Block): void {
  sp.updatedAtBlock = block.number
  sp.updatedAt = block.timestamp
  sp.save()
}
