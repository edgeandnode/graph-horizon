import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { DataService } from "../../generated/schema"
import { BIGINT_ZERO } from "../common/constants"

export class DataServiceResult {
  entity: DataService
  isNew: boolean

  constructor(entity: DataService, isNew: boolean) {
    this.entity = entity
    this.isNew = isNew
  }
}

export function getOrCreateDataService(
  id: Bytes,
  blockNumber: BigInt,
  timestamp: BigInt
): DataServiceResult {
  let entity = DataService.load(id)
  let isNew = entity == null

  if (entity == null) {
    entity = new DataService(id)

    // Counts
    entity.countServiceProviders = 0
    entity.countProvisions = 0
    entity.countDelegationPools = 0
    entity.countProvisionSlashEvents = 0
    entity.countDelegationPoolSlashEvents = 0

    // Tokens
    entity.tokensProvisioned = BIGINT_ZERO
    entity.tokensDelegated = BIGINT_ZERO
    entity.tokensThawingFromProvisions = BIGINT_ZERO
    entity.tokensThawingFromDelegationPools = BIGINT_ZERO

    // Slashing
    entity.tokensSlashed = BIGINT_ZERO
    entity.tokensSlashedFromProvisions = BIGINT_ZERO
    entity.tokensSlashedFromDelegationPools = BIGINT_ZERO

    // Metadata
    entity.createdAtBlock = blockNumber
    entity.createdAt = timestamp
    entity.updatedAtBlock = blockNumber
    entity.updatedAt = timestamp
  }

  return new DataServiceResult(entity, isNew)
}

export function saveDataService(ds: DataService, block: ethereum.Block): void {
  ds.updatedAtBlock = block.number
  ds.updatedAt = block.timestamp
  ds.save()
}
