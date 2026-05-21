import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { EscrowAccount } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class EscrowAccountResult {
  entity: EscrowAccount
  isNew: boolean

  constructor(entity: EscrowAccount, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getEscrowAccountId(payer: Bytes, collector: Bytes, serviceProvider: Bytes): Bytes {
  return payer.concat(collector).concat(serviceProvider)
}

/**
 * Gets or creates an EscrowAccount entity.
 * Escrow accounts hold tokens deposited by payers for service providers,
 * which can be collected by authorized collectors.
 */
export function getOrCreateEscrowAccount(
  payer: Bytes,
  collector: Bytes,
  serviceProvider: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): EscrowAccountResult {
  let id = getEscrowAccountId(payer, collector, serviceProvider)
  let entity = EscrowAccount.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new EscrowAccount(id)

    // Relationships
    entity.payer = payer
    entity.collector = collector
    entity.serviceProvider = serviceProvider

    // Tokens
    entity.tokens = BIGINT_ZERO
    entity.tokensThawing = BIGINT_ZERO
    entity.thawEndTimestamp = BIGINT_ZERO
    entity.tokensCollected = BIGINT_ZERO

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new EscrowAccountResult(entity, isNew)
}

export function saveEscrowAccount(escrowAccount: EscrowAccount, block: ethereum.Block): void {
  escrowAccount.updatedAtBlock = block.number
  escrowAccount.updatedAt = block.timestamp
  escrowAccount.save()
}
