import { Address } from "@graphprotocol/graph-ts"
import { NetworkConfig } from "../types"
import { SERVICE_PROVIDER_ADDRESSES } from "./seed"

export const config = new NetworkConfig(
  "arbitrum-one",
  Address.fromString("0x00669A4CF01450B64E8A2A20E9b1FCB71E61eF03"),
  408_825_706,
  SERVICE_PROVIDER_ADDRESSES
)
