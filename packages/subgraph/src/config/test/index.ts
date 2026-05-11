import { Address } from "@graphprotocol/graph-ts"
import { NetworkConfig } from "../types"
import { SERVICE_PROVIDER_ADDRESSES } from "./seed"

export const config = new NetworkConfig(
  "test",
  Address.fromString("0x4444444444444444444444444444444444444444"),
  1,
  SERVICE_PROVIDER_ADDRESSES
)
