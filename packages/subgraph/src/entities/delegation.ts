import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Delegation } from "../../generated/schema"
import { HorizonStaking } from "../../generated/HorizonStaking/HorizonStaking"
import { BIGINT_ZERO } from "../common/constants"
import { config } from "../config"
import { getDelegationPoolId } from "./delegationPool"

export function getDelegationId(delegator: Bytes, serviceProvider: Bytes, verifier: Bytes): Bytes {
  return delegator.concat(serviceProvider).concat(verifier)
}

export class DelegationResult {
  entity: Delegation
  isNew: boolean

  constructor(entity: Delegation, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates a Delegation entity.
 * If the entity is new, fetches current shares from the contract (lazy initialization).
 * This handles legacy delegations that weren't seeded at genesis.
 */
export function getOrCreateDelegation(
  delegator: Bytes,
  serviceProvider: Bytes,
  verifier: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): DelegationResult {
  let id = getDelegationId(delegator, serviceProvider, verifier)
  let entity = Delegation.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new Delegation(id)
    entity.delegator = delegator
    entity.pool = getDelegationPoolId(serviceProvider, verifier)
    entity.tokensLocked = BIGINT_ZERO
    entity.tokensLockedUntil = BIGINT_ZERO
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp

    // Lazy init: fetch current shares from contract
    let horizonStaking = HorizonStaking.bind(config.horizonStakingAddress)
    let delegationState = horizonStaking.getDelegation(
      Address.fromBytes(serviceProvider),
      Address.fromBytes(verifier),
      Address.fromBytes(delegator)
    )
    entity.shares = delegationState.shares
  }

  return new DelegationResult(entity, isNew)
}

export function saveDelegation(delegation: Delegation, block: ethereum.Block): void {
  delegation.updatedAtBlock = block.number
  delegation.updatedAt = block.timestamp
  delegation.save()
}
