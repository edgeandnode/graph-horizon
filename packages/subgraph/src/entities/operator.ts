import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Operator } from "../../generated/schema"

export class OperatorResult {
  entity: Operator
  isNew: boolean

  constructor(entity: Operator, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates an Operator entity.
 * Operators are addresses authorized to act on behalf of service providers.
 */
export function getOrCreateOperator(
  operatorAddress: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): OperatorResult {
  let entity = Operator.load(operatorAddress)
  let isNew = entity == null

  if (entity == null) {
    entity = new Operator(operatorAddress)

    // Counts
    entity.countAuthorizations = 0

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new OperatorResult(entity, isNew)
}

export function saveOperator(operator: Operator, block: ethereum.Block): void {
  operator.updatedAtBlock = block.number
  operator.updatedAt = block.timestamp
  operator.save()
}
