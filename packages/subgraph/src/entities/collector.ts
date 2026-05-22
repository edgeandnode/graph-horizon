import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Collector } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class CollectorResult {
  entity: Collector
  isNew: boolean

  constructor(entity: Collector, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates a Collector entity.
 * Collectors are contracts authorized to collect payments from escrow accounts.
 */
export function getOrCreateCollector(id: Bytes, blockNumber: BigInt, timestamp: BigInt): CollectorResult {
  let entity = Collector.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new Collector(id)

    // Counts
    entity.countEscrowAccounts = 0

    // Tokens
    entity.tokensEscrowed = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO
    entity.tokensCollected = BIGINT_ZERO

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new CollectorResult(entity, isNew)
}

export function saveCollector(collector: Collector, block: ethereum.Block): void {
  collector.updatedAtBlock = block.number
  collector.updatedAt = block.timestamp
  collector.save()
}
