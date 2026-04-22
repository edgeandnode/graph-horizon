import { Console, Effect } from "effect"
import { ethers } from "ethers"

export class Display {
  // ANSI color codes
  static colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m"
  }

  static colorize(text: string, color: keyof typeof Display.colors): string {
    return `${Display.colors[color]}${text}${Display.colors.reset}`
  }

  static bold(text: string): string {
    return `${Display.colors.bright}${text}${Display.colors.reset}`
  }

  static boldColor(text: string, color: keyof typeof Display.colors): string {
    return `${Display.colors.bright}${Display.colors[color]}${text}${Display.colors.reset}`
  }

  static header(title: string): Effect.Effect<void, never> {
    const line = "═".repeat(50)
    return Effect.gen(function*() {
      yield* Console.log("")
      yield* Console.log(Display.colorize(line, "cyan"))
      yield* Console.log(Display.colorize(`  ${title}`, "bright"))
      yield* Console.log(Display.colorize(line, "cyan"))
    })
  }

  static success(message: string): Effect.Effect<void, never> {
    return Console.log(Display.colorize(`✅ ${message}`, "green"))
  }

  static info(message: string): Effect.Effect<void, never> {
    return Console.log(Display.colorize(`ℹ️  ${message}`, "blue"))
  }

  static warning(message: string): Effect.Effect<void, never> {
    return Console.log(Display.colorize(`⚠️  ${message}`, "yellow"))
  }

  static error(message: string): Effect.Effect<void, never> {
    return Console.log(Display.colorize(`❌ ${message}`, "red"))
  }

  static keyValue(key: string, value: string | bigint | number): Effect.Effect<void, never> {
    const formattedKey = Display.colorize(key.padEnd(30), "cyan")
    const formattedValue = Display.colorize(String(value), "white")
    return Console.log(`  ${formattedKey} ${formattedValue}`)
  }

  static tripleString(first: string, second: string, third: string): Effect.Effect<void, never> {
    const formattedFirst = Display.colorize(first.padEnd(30), "cyan")
    const formattedSecond = Display.colorize(second.padEnd(6), "blue")
    const formattedThird = Display.colorize(third.padEnd(30), "white")
    return Console.log(`  ${formattedFirst} ${formattedSecond} ${formattedThird}`)
  }

  static quadString(first: string, second: string, third: string, fourth: string): Effect.Effect<void, never> {
    const formattedFirst = Display.colorize(first.padEnd(44), "cyan")
    const formattedSecond = Display.colorize(second.padEnd(10), "blue")
    const formattedThird = Display.colorize(third.padEnd(10), "green")
    const formattedFourth = Display.colorize(fourth.padEnd(30), "white")
    return Console.log(`  ${formattedFirst} ${formattedSecond} ${formattedThird} ${formattedFourth}`)
  }

  static fiveString(
    first: string,
    second: string,
    third: string,
    fourth: string,
    fifth: string
  ): Effect.Effect<void, never> {
    const formattedFirst = Display.colorize(first.padEnd(44), "cyan")
    const formattedSecond = Display.colorize(second.padEnd(10), "blue")
    const formattedThird = Display.colorize(third.padEnd(10), "green")
    const formattedFourth = Display.colorize(fourth.padEnd(12), "yellow")
    const formattedFifth = Display.colorize(fifth.padEnd(30), "white")
    return Console.log(`  ${formattedFirst} ${formattedSecond} ${formattedThird} ${formattedFourth} ${formattedFifth}`)
  }

  static sixString(
    first: string,
    second: string,
    third: string,
    fourth: string,
    fifth: string,
    sixth: string
  ): Effect.Effect<void, never> {
    const formattedFirst = Display.colorize(first.padEnd(44), "cyan")
    const formattedSecond = Display.colorize(second.padEnd(10), "blue")
    const formattedThird = Display.colorize(third.padEnd(10), "green")
    const formattedFourth = Display.colorize(fourth.padEnd(12), "yellow")
    const formattedFifth = Display.colorize(fifth.padEnd(10), "magenta")
    const formattedSixth = Display.colorize(sixth.padEnd(30), "white")
    return Console.log(`  ${formattedFirst} ${formattedSecond} ${formattedThird} ${formattedFourth} ${formattedFifth} ${formattedSixth}`)
  }

  static section(title: string): Effect.Effect<void, never> {
    return Effect.gen(function*() {
      yield* Console.log("")
      yield* Console.log(Display.colorize(`📊 ${title}`, "magenta"))
      yield* Console.log(Display.colorize("─".repeat(30), "dim"))
    })
  }

  static table<T extends Record<string, any>>(data: T): Effect.Effect<void, never> {
    return Effect.gen(function*() {
      for (const [key, value] of Object.entries(data)) {
        const formattedKey = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
        yield* Display.keyValue(formattedKey, value)
      }
    })
  }

  static bigNumber(label: string, value: bigint): Effect.Effect<void, never> {
    const formatted = bigintToString(value)
    return Display.keyValue(label, formatted)
  }

  static tokenValue(label: string, value: bigint): Effect.Effect<void, never> {
    return Display.keyValue(label, `${ethers.formatEther(value)} GRT`.replace(/\B(?=(\d{3})+(?!\d))/g, ","))
  }

  static totalTokenValue(label: string, value: bigint): Effect.Effect<void, never> {
    const formattedValue = `${ethers.formatEther(value)} GRT`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const formattedKey = Display.boldColor(label.padEnd(30), "cyan")
    return Console.log(`  ${formattedKey} ${Display.bold(formattedValue)}`)
  }

  static timeValue(label: string, value: bigint): Effect.Effect<void, never> {
    return Display.keyValue(label, `${formatTime(value)} (${value} seconds)`)
  }

  static ppmValue(label: string, value: bigint): Effect.Effect<void, never> {
    const formatted = (value / 10_000n).toString()
    return Display.keyValue(label, `${formatted}% (${value} ppm)`)
  }

  static rangeValue(label: string, min: bigint, max: bigint): Effect.Effect<void, never> {
    return Display.keyValue(label, `[${bigintToString(min)} - ${bigintToString(max)}]`)
  }

  static tokenRangeValue(label: string, min: bigint, max: bigint): Effect.Effect<void, never> {
    return Display.keyValue(label, `[${bigintToString(min, true)} - ${bigintToString(max, true)}]`)
  }

  static ppmRangeValue(label: string, min: bigint, max: bigint): Effect.Effect<void, never> {
    return Display.keyValue(label, `[${(min / 10_000n).toString()}% - ${(max / 10_000n).toString()}%]`)
  }

  static timeRangeValue(label: string, min: bigint, max: bigint): Effect.Effect<void, never> {
    return Display.keyValue(label, `[${formatTime(min)} - ${formatTime(max)}]`)
  }

  static spinner(message: string): Effect.Effect<void, never> {
    return Console.log(Display.colorize(`⏳ ${message}`, "yellow"))
  }

  static divider(): Effect.Effect<void, never> {
    return Console.log("\n" + Display.colorize("▔".repeat(50), "dim"))
  }
}

function formatTime(seconds: bigint): string {
  const oneDay = 24n * 60n * 60n
  if (seconds < oneDay) {
    const hours = seconds / 3600n
    return `${hours} hour${hours === 1n ? "" : "s"}`
  } else {
    const days = seconds / oneDay
    return `${days} day${days === 1n ? "" : "s"}`
  }
}

function bigintToString(value: bigint, token: boolean = false): string {
  const UINT32_MAX = (1n << 32n) - 1n // 2^32 - 1
  const UINT64_MAX = (1n << 64n) - 1n // 2^64 - 1
  const UINT128_MAX = (1n << 128n) - 1n // 2^128 - 1
  const UINT256_MAX = (1n << 256n) - 1n // 2^256 - 1
  if (value === UINT32_MAX) return "UINT32_MAX"
  if (value === UINT64_MAX) return "UINT64_MAX"
  if (value === UINT128_MAX) return "UINT128_MAX"
  if (value === UINT256_MAX) return "UINT256_MAX"

  return (token ?
    `${ethers.formatEther(value)} GRT` :
    value.toString()).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function blue(text: string): string {
  return Display.colorize(text, "blue")
}

export function green(text: string): string {
  return Display.colorize(text, "green")
}
