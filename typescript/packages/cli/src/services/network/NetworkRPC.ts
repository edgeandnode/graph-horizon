import { connectGraphHorizon, connectSubgraphService } from "@graphprotocol/toolshed/deployments"
import { Context, Data, Effect, Layer } from "effect"
import { AbiCoder, JsonRpcProvider, keccak256 } from "ethers"
import { ConfigService } from "../ConfigService.js"
import type { NetworkDataSource } from "./NetworkDataSource.js"

export class NetworkRPCError extends Data.TaggedError("NetworkRPCError")<{
  message: string
  method?: string
  contract?: string
}> {}

export class NetworkRPC extends Context.Tag("NetworkRPC")<NetworkRPC, NetworkDataSource>() {}

export const NetworkRPCLive = Layer.effect(
  NetworkRPC,
  Effect.gen(function*() {
    const config = yield* ConfigService
    const provider = new JsonRpcProvider(config.rpcUrl)
    const network = yield* Effect.tryPromise({
      try: () => provider.getNetwork(),
      catch: (error) =>
        new NetworkRPCError({
          message: `Failed to get network info: ${error}`
        })
    })
    const chainId = Number(network.chainId)

    const horizonContracts = yield* Effect.try({
      try: () => connectGraphHorizon(chainId, provider as any),
      catch: (error) =>
        new NetworkRPCError({
          message: `Failed to connect to Graph Horizon contracts: ${error}`
        })
    })
    const subgraphServiceContracts = yield* Effect.try({
      try: () => connectSubgraphService(chainId, provider as any),
      catch: (error) =>
        new NetworkRPCError({
          message: `Failed to connect to Subgraph Service contracts: ${error}`
        })
    })

    const getGraphNetwork = () =>
      Effect.gen(function*() {
        const rawResult = yield* Effect.all(
          {
            maxThawingPeriod: Effect.tryPromise({
              try: () => horizonContracts.HorizonStaking.getMaxThawingPeriod(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `getMaxThawingPeriod failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getMaxThawingPeriod"
                })
            })
          },
          { concurrency: "unbounded" }
        )

        return rawResult
      })

    const getSubgraphService = () =>
      Effect.gen(function*() {
        const rawResult = yield* Effect.all(
          {
            provisionTokensRange: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.getProvisionTokensRange(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `getProvisionTokensRange failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "getProvisionTokensRange"
                })
            }),
            thawingPeriodRange: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.getThawingPeriodRange(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `getThawingPeriodRange failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "getThawingPeriodRange"
                })
            }),
            verifierCutRange: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.getVerifierCutRange(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `getVerifierCutRange failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "getVerifierCutRange"
                })
            }),
            delegationRatio: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.getDelegationRatio(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `getDelegationRatio failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "getDelegationRatio"
                })
            }),
            curationFeesCut: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.curationFeesCut(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `curationFeesCut failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "curationFeesCut"
                })
            }),
            maxPOIStaleness: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.maxPOIStaleness(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `maxPOIStaleness failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "maxPOIStaleness"
                })
            }),
            stakeToFeesRatio: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.stakeToFeesRatio(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `stakeToFeesRatio failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "stakeToFeesRatio"
                })
            })
          },
          { concurrency: "unbounded" }
        )

        return {
          minimumProvisionTokens: rawResult.provisionTokensRange[0],
          maximumProvisionTokens: rawResult.provisionTokensRange[1],
          minimumVerifierCut: rawResult.verifierCutRange[0],
          maximumVerifierCut: rawResult.verifierCutRange[1],
          minimumThawingPeriod: rawResult.thawingPeriodRange[0],
          maximumThawingPeriod: rawResult.thawingPeriodRange[1],
          maxPOIStaleness: rawResult.maxPOIStaleness,
          delegationRatio: rawResult.delegationRatio,
          stakeToFeesRatio: rawResult.stakeToFeesRatio,
          curationCut: rawResult.curationFeesCut
        }
      })

    const getDisputeManager = () =>
      Effect.gen(function*() {
        const rawResult = yield* Effect.all(
          {
            disputePeriod: Effect.tryPromise({
              try: () => subgraphServiceContracts.DisputeManager.disputePeriod(),

              catch: (e) =>
                new NetworkRPCError({
                  message: `disputePeriod failed: ${String(e)}`,
                  contract: "DisputeManager",
                  method: "disputePeriod"
                })
            }),
            fishermanRewardCut: Effect.tryPromise({
              try: () => subgraphServiceContracts.DisputeManager.fishermanRewardCut(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `fishermanRewardCut failed: ${String(e)}`,
                  contract: "DisputeManager",
                  method: "fishermanRewardCut"
                })
            }),
            disputeDeposit: Effect.tryPromise({
              try: () => subgraphServiceContracts.DisputeManager.disputeDeposit(),
              catch: (e) =>
                new NetworkRPCError({
                  message: `disputeDeposit failed: ${String(e)}`,
                  contract: "DisputeManager",
                  method: "disputeDeposit"
                })
            })
          },
          { concurrency: "unbounded" }
        )

        return {
          disputePeriod: rawResult.disputePeriod,
          fishermanRewardCut: rawResult.fishermanRewardCut,
          disputeDeposit: rawResult.disputeDeposit
        }
      })

    const getIndexer = (address: string) =>
      Effect.gen(function*() {
        const rawResult = yield* Effect.all(
          {
            registrationData: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.indexers(address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `id failed: ${String(e)}`,
                  contract: "Indexer",
                  method: "id"
                })
            }),
            rewardsDestination: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.paymentsDestination(address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `paymentsDestination failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "paymentsDestination"
                })
            }),
            serviceProvider: Effect.tryPromise({
              try: () => horizonContracts.HorizonStaking.getServiceProvider(address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `stakedTokens failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getStake"
                })
            }),
            delegationPool: Effect.tryPromise({
              try: () =>
                horizonContracts.HorizonStaking.getDelegationPool(
                  address,
                  subgraphServiceContracts.SubgraphService.target
                ),
              catch: (e) =>
                new NetworkRPCError({
                  message: `delegationPool failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getDelegationPool"
                })
            }),
            provision: Effect.tryPromise({
              try: () =>
                horizonContracts.HorizonStaking.getProvision(address, subgraphServiceContracts.SubgraphService.target),
              catch: (e) =>
                new NetworkRPCError({
                  message: `provision failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getProvision"
                })
            }),
            allocationProvisionTracker: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.allocationProvisionTracker(address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `allocationProvisionTracker failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "allocationProvisionTracker"
                })
            }),
            feesProvisionTracker: Effect.tryPromise({
              try: () => subgraphServiceContracts.SubgraphService.feesProvisionTracker(address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `feesProvisionTracker failed: ${String(e)}`,
                  contract: "SubgraphService",
                  method: "feesProvisionTracker"
                })
            }),
            legacyData: Effect.tryPromise({
              try: () => getLegacyData(provider, horizonContracts.HorizonStaking.target.toString(), address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `legacyTokensAllocated failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getLegacyTokensAllocated"
                })
            }),
            idleTokens: Effect.tryPromise({
              try: () => horizonContracts.HorizonStaking.getIdleStake(address),
              catch: (e) =>
                new NetworkRPCError({
                  message: `idleTokens failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getIdleStake"
                })
            }),
            availableTokens: Effect.tryPromise({
              try: () =>
                horizonContracts.HorizonStaking.getTokensAvailable(
                  address,
                  subgraphServiceContracts.SubgraphService.target,
                  16
                ),
              catch: (e) =>
                new NetworkRPCError({
                  message: `availableTokens failed: ${String(e)}`,
                  contract: "HorizonStaking",
                  method: "getTokensAvailable"
                })
            }),
            escrowAccount: Effect.tryPromise({
              try: () =>
                horizonContracts.PaymentsEscrow.escrowAccounts(
                  config.gatewayPayer,
                  horizonContracts.GraphTallyCollector.target,
                  address
                ),
              catch: (e) =>
                new NetworkRPCError({
                  message: `escrowAccounts failed: ${String(e)}`,
                  contract: "PaymentsEscrow",
                  method: "escrowAccounts"
                })
            })
          },
          { concurrency: "unbounded" }
        )

        return {
          id: address,
          url: rawResult.registrationData.url,
          geoHash: rawResult.registrationData.geoHash,
          rewardsDestination: rawResult.rewardsDestination.toLowerCase(),
          stakedTokens: rawResult.serviceProvider.tokensStaked,
          delegatedTokens: rawResult.delegationPool.tokens,
          delegatedThawingTokens: rawResult.delegationPool.tokensThawing,
          totalProvisionedTokens: rawResult.serviceProvider.tokensProvisioned,
          legacyTokensAllocated: rawResult.legacyData.tokensAllocated,
          tokensLocked: rawResult.legacyData.tokensLocked,
          idleTokens: rawResult.idleTokens,
          availableTokens: rawResult.availableTokens,
          provisionedTokens: rawResult.provision.tokens,
          allocatedTokens: rawResult.allocationProvisionTracker,
          feesProvisionedTokens: rawResult.feesProvisionTracker,
          thawingTokens: rawResult.provision.tokensThawing,
          tokensFree: rawResult.availableTokens - rawResult.allocationProvisionTracker,
          escrowAccountBalance: rawResult.escrowAccount.balance,
          escrowAccountTokensThawing: rawResult.escrowAccount.tokensThawing,
          escrowAccountThawEndTimestamp: rawResult.escrowAccount.thawEndTimestamp
        }
      })

    return NetworkRPC.of({
      getGraphNetwork,
      getSubgraphService,
      getDisputeManager,
      getIndexer
    })
  })
)

async function getLegacyData(
  provider: JsonRpcProvider,
  stakingAddress: string,
  serviceProvider: string
): Promise<{ tokensAllocated: bigint; tokensLocked: bigint }> {
  const slotNumber = 14n

  // Compute the mapping base slot: keccak256(abi.encode(serviceProvider, slotNumber))
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256"],
    [serviceProvider, slotNumber]
  )
  const baseSlot = BigInt(keccak256(encoded))

  // Fetch storage slots in parallel
  const [allocatedRaw, lockedRaw] = await Promise.all([
    provider.getStorage(stakingAddress, baseSlot + 1n),
    provider.getStorage(stakingAddress, baseSlot + 2n)
  ])

  return {
    tokensAllocated: BigInt(allocatedRaw),
    tokensLocked: BigInt(lockedRaw)
  }
}
