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

    // Counts
    entity.countProvisions = 0
    entity.countProvisionSlashEvents = 0
    entity.countDelegationPoolSlashEvents = 0

    // Stake
    entity.tokensStaked = BIGINT_ZERO
    entity.tokensProvisioned = BIGINT_ZERO
    entity.tokensIdle = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO

    // Delegation
    entity.tokensDelegated = BIGINT_ZERO
    entity.tokensDelegatedThawing = BIGINT_ZERO

    // Slashing
    entity.tokensSlashed = BIGINT_ZERO
    entity.tokensSlashedFromProvisions = BIGINT_ZERO
    entity.tokensSlashedFromDelegationPools = BIGINT_ZERO

    // Metadata
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
