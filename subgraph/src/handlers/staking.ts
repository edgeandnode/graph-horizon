import { HorizonStakeDeposited } from "../../generated/HorizonStaking/HorizonStaking"
import { getOrCreateGraphNetwork } from "../entities/graphNetwork"

export function handleHorizonStakeDeposited(event: HorizonStakeDeposited): void {
  let graphNetwork = getOrCreateGraphNetwork()
  graphNetwork.save()
}
