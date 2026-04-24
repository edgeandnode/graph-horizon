import { GraphNetwork } from "../../generated/schema"
import { GRAPH_NETWORK_ID } from "../common/constants"

export function getOrCreateGraphNetwork(): GraphNetwork {
  let entity = GraphNetwork.load(GRAPH_NETWORK_ID)
  if (entity == null) {
    entity = new GraphNetwork(GRAPH_NETWORK_ID)
  }
  return entity
}
