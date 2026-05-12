import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { DelegationPool } from "../../generated/schema"
import { HorizonStaking } from "../../generated/HorizonStaking/HorizonStaking"
import { BIGINT_ZERO } from "../common/constants"
import { config } from "../config"

export function getDelegationPoolId(serviceProvider: Bytes, verifier: Bytes): Bytes {
  return serviceProvider.concat(verifier)
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
 * If the entity is new, fetches current state from the contract (lazy initialization).
 * This handles legacy delegations that weren't seeded at genesis.
 */
export function getOrCreateDelegationPool(
  serviceProvider: Bytes,
  verifier: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): DelegationPoolResult {
  let id = getDelegationPoolId(serviceProvider, verifier)
  let entity = DelegationPool.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new DelegationPool(id)
    entity.serviceProvider = serviceProvider
    entity.verifier = verifier
    entity.countDelegators = 0
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp

    // Lazy init: fetch current state from contract
    let horizonStaking = HorizonStaking.bind(config.horizonStakingAddress)
    let poolState = horizonStaking.getDelegationPool(
      Address.fromBytes(serviceProvider),
      Address.fromBytes(verifier)
    )
    entity.tokens = poolState.tokens
    entity.shares = poolState.shares
    entity.tokensThawing = poolState.tokensThawing
    entity.sharesThawing = poolState.sharesThawing
  }

  return new DelegationPoolResult(entity, isNew)
}

export function saveDelegationPool(pool: DelegationPool, block: ethereum.Block): void {
  pool.updatedAtBlock = block.number
  pool.updatedAt = block.timestamp
  pool.save()
}
