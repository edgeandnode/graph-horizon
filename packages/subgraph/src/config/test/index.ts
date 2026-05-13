import { Address } from "@graphprotocol/graph-ts"
import { NetworkConfig } from "../types"
import { SERVICE_PROVIDER_ADDRESSES } from "./indexer-seed"
import { DELEGATED_INDEXER_ADDRESSES } from "./delegation-seed"

export const config = new NetworkConfig(
  "test",
  Address.fromString("0x4444444444444444444444444444444444444444"),
  Address.fromString("0x5555555555555555555555555555555555555555"),
  1,
  SERVICE_PROVIDER_ADDRESSES,
  DELEGATED_INDEXER_ADDRESSES
)
