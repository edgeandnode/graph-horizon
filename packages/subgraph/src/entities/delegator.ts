import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Delegator } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class DelegatorResult {
  entity: Delegator
  isNew: boolean

  constructor(entity: Delegator, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getOrCreateDelegator(
  id: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): DelegatorResult {
  let entity = Delegator.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new Delegator(id)
    entity.tokensDelegated = BIGINT_ZERO
    entity.countDelegations = 0
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new DelegatorResult(entity, isNew)
}

export function saveDelegator(delegator: Delegator, block: ethereum.Block): void {
  delegator.updatedAtBlock = block.number
  delegator.updatedAt = block.timestamp
  delegator.save()
}
