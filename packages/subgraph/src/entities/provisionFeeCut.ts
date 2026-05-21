import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { ProvisionFeeCut } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"
import { getProvisionId } from "./provision"

export function getProvisionFeeCutId(serviceProvider: Bytes, dataService: Bytes, paymentType: i32): Bytes {
  let provisionId = getProvisionId(serviceProvider, dataService)
  return provisionId.concat(Bytes.fromI32(paymentType))
}

export class ProvisionFeeCutResult {
  entity: ProvisionFeeCut
  isNew: boolean

  constructor(entity: ProvisionFeeCut, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates a ProvisionFeeCut entity.
 * Tracks the fee cut percentage for delegators by payment type on a provision.
 */
export function getOrCreateProvisionFeeCut(
  serviceProvider: Bytes,
  dataService: Bytes,
  paymentType: i32,
  blockNumber: BigInt,
  timestamp: BigInt
): ProvisionFeeCutResult {
  let id = getProvisionFeeCutId(serviceProvider, dataService, paymentType)
  let entity = ProvisionFeeCut.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new ProvisionFeeCut(id)

    // Relationships
    entity.serviceProvider = serviceProvider
    entity.dataService = dataService
    entity.provision = getProvisionId(serviceProvider, dataService)

    // State
    entity.paymentType = paymentType
    entity.feeCut = BIGINT_ZERO

    // Metadata
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new ProvisionFeeCutResult(entity, isNew)
}

export function saveProvisionFeeCut(feeCut: ProvisionFeeCut, block: ethereum.Block): void {
  feeCut.updatedAtBlock = block.number
  feeCut.updatedAt = block.timestamp
  feeCut.save()
}
