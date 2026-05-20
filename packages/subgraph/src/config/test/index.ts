import { Address } from "@graphprotocol/graph-ts"
import { NetworkConfig } from "../types"
import { SERVICE_PROVIDER_ADDRESSES } from "./indexer-seed"
import { DELEGATED_INDEXER_ADDRESSES, LEGACY_INDEXER_REWARD_CUTS } from "./delegation-seed"
import { OPERATOR_SERVICE_PROVIDERS, OPERATORS } from "./operator-seed"

export const config = new NetworkConfig(
  "test",
  Address.fromString("0x4444444444444444444444444444444444444444"),
  Address.fromString("0x5555555555555555555555555555555555555555"),
  1,
  SERVICE_PROVIDER_ADDRESSES,
  DELEGATED_INDEXER_ADDRESSES,
  LEGACY_INDEXER_REWARD_CUTS,
  OPERATOR_SERVICE_PROVIDERS,
  OPERATORS
)
