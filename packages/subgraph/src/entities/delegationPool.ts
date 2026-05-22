import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { DelegationPool } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"
import { twoPartId } from "../common/ids"

export function getDelegationPoolId(serviceProvider: Bytes, dataService: Bytes): Bytes {
  return twoPartId(serviceProvider, dataService)
}

export class DelegationPoolResult {
  entity: DelegationPool
  isNew: boolean

  constructor(entity: DelegationPool, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates a DelegationPool entity.
 * Pools are seeded at genesis for all indexers with delegations.
 * New pools after genesis are created via TokensDelegated events.
 */
export function getOrCreateDelegationPool(
  serviceProvider: Bytes,
  dataService: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): DelegationPoolResult {
  let id = getDelegationPoolId(serviceProvider, dataService)
  let entity = DelegationPool.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new DelegationPool(id)

    // Relationships
    entity.serviceProvider = serviceProvider
    entity.dataService = dataService

    // Pool state
    entity.tokens = BIGINT_ZERO
    entity.shares = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO
    entity.tokensDistributed = BIGINT_ZERO
    entity.tokensSlashed = BIGINT_ZERO

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new DelegationPoolResult(entity, isNew)
}

export function saveDelegationPool(pool: DelegationPool, block: ethereum.Block): void {
  pool.updatedAtBlock = block.number
  pool.updatedAt = block.timestamp
  pool.save()
}
