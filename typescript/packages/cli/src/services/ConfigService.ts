import { ArrayFormatter, Schema } from "@effect/schema"
import { Context, Data, Effect, Layer } from "effect"
import { AppConfig, loadConfig } from "../Config.js"

export class ConfigServiceError extends Data.TaggedError("ConfigServiceError")<{
  message: string
}> {}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AppConfig
>() {}

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function*() {
    const rawConfig = yield* loadConfig
    const config = yield* Schema.decodeUnknown(AppConfig)(rawConfig)
    return ConfigService.of(config)
  }).pipe(
    Effect.catchTag("ConfigError", (error) => {
      const msg = `Invalid configuration:\n - ${error.message}`
      return Effect.fail(new ConfigServiceError({ message: msg }))
    }),
    Effect.catchTag("ParseError", (e) =>
      ArrayFormatter.formatError(e).pipe(
        Effect.flatMap((issues) => {
          const formattedIssues = issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
          const msg = `Invalid configuration:\n${formattedIssues.join("\n")}`
          return Effect.fail(new ConfigServiceError({ message: msg }))
        })
      )),
    Effect.catchAll((error) => {
      return Effect.fail(new ConfigServiceError({ message: error.message }))
    })
  )
)
