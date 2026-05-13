import { Address } from "@graphprotocol/graph-ts"
import { NetworkConfig } from "../types"
import { SERVICE_PROVIDER_ADDRESSES } from "./indexer-seed"
import { DELEGATED_INDEXER_ADDRESSES } from "./delegation-seed"

export const config = new NetworkConfig(
  "arbitrum-one",
  Address.fromString("0x00669A4CF01450B64E8A2A20E9b1FCB71E61eF03"),
  Address.fromString("0xb2Bb92d0DE618878E438b55D5846cfecD9301105"),
  408_825_706,
  SERVICE_PROVIDER_ADDRESSES,
  DELEGATED_INDEXER_ADDRESSES
)
