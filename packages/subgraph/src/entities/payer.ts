import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Payer } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class PayerResult {
  entity: Payer
  isNew: boolean

  constructor(entity: Payer, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

/**
 * Gets or creates a Payer entity.
 * Payers are addresses that deposit funds into escrow accounts.
 */
export function getOrCreatePayer(id: Bytes, blockNumber: BigInt, timestamp: BigInt): PayerResult {
  let entity = Payer.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new Payer(id)

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

  return new PayerResult(entity, isNew)
}

export function savePayer(payer: Payer, block: ethereum.Block): void {
  payer.updatedAtBlock = block.number
  payer.updatedAt = block.timestamp
  payer.save()
}
