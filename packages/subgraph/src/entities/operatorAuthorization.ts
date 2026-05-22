import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { OperatorAuthorization } from "../../generated/schema"
import { threePartId } from "../common/ids"

export function getOperatorAuthorizationId(
  operator: Bytes,
  serviceProvider: Bytes,
  dataService: Bytes
): Bytes {
  return threePartId(operator, serviceProvider, dataService)
}

export class OperatorAuthorizationResult {
  entity: OperatorAuthorization
  isNew: boolean

  constructor(entity: OperatorAuthorization, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates an OperatorAuthorization entity.
 * Tracks whether an operator is authorized to act on behalf of a service provider
 * for a specific data service.
 */
export function getOrCreateOperatorAuthorization(
  operator: Bytes,
  serviceProvider: Bytes,
  dataService: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): OperatorAuthorizationResult {
  let id = getOperatorAuthorizationId(operator, serviceProvider, dataService)
  let entity = OperatorAuthorization.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new OperatorAuthorization(id)

    // Relationships
    entity.operator = operator
    entity.serviceProvider = serviceProvider
    entity.dataService = dataService

    // State
    entity.allowed = false

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new OperatorAuthorizationResult(entity, isNew)
}

export function saveOperatorAuthorization(
  authorization: OperatorAuthorization,
  block: ethereum.Block
): void {
  authorization.updatedAtBlock = block.number
  authorization.updatedAt = block.timestamp
  authorization.save()
}
