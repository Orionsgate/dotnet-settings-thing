export const FormatId = {
  AzureAppSettings: 'azure-app-settings',
  AppSettingsJson: 'appsettings-json',
  LocalSettingsJson: 'local-settings-json',
  DotEnv: 'dotenv',
} as const

export type Format = (typeof FormatId)[keyof typeof FormatId]

export const formatOptions: Format[] = [
  FormatId.AzureAppSettings,
  FormatId.AppSettingsJson,
  FormatId.LocalSettingsJson,
  FormatId.DotEnv,
]

export const formatLabelById: Record<Format, string> = {
  [FormatId.AzureAppSettings]: 'Azure app settings',
  [FormatId.AppSettingsJson]: 'appsettings.json',
  [FormatId.LocalSettingsJson]: 'local.settings.json',
  [FormatId.DotEnv]: '.env',
}

export type PrimitiveValue = string | number | boolean | null

export type Entry = {
  key: string
  value: PrimitiveValue
}

export const isTypeAgnosticFormat = (format: Format): boolean =>
  format === FormatId.DotEnv || format === FormatId.AzureAppSettings

export const isTypedJsonFormat = (format: Format): boolean =>
  format === FormatId.AppSettingsJson || format === FormatId.LocalSettingsJson

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPrimitive = (value: unknown): value is PrimitiveValue =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  value === null

const dedupeEntries = (entries: Entry[]): Entry[] => {
  const map = new Map<string, PrimitiveValue>()

  for (const entry of entries) {
    map.delete(entry.key)
    map.set(entry.key, entry.value)
  }

  return Array.from(map, ([key, value]) => ({ key, value }))
}

const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

const coerceStringScalar = (value: string): PrimitiveValue => {
  const trimmed = value.trim()

  if (trimmed === 'true') {
    return true
  }

  if (trimmed === 'false') {
    return false
  }

  if (numberPattern.test(trimmed)) {
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return value
}

export const coerceEntriesForTypedOutput = (
  entries: Entry[],
  inputFormat: Format,
  outputFormat: Format,
): Entry[] => {
  if (!isTypeAgnosticFormat(inputFormat) || !isTypedJsonFormat(outputFormat)) {
    return entries
  }

  return entries.map((entry) => ({
    key: entry.key,
    value: typeof entry.value === 'string' ? coerceStringScalar(entry.value) : entry.value,
  }))
}

const flattenValue = (
  prefix: string,
  value: unknown,
  out: Entry[],
): void => {
  if (isPrimitive(value)) {
    out.push({ key: prefix, value })
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenValue(`${prefix}__${index}`, item, out)
    })
    return
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      flattenValue(`${prefix}__${childKey}`, childValue, out)
    })
    return
  }

  throw new Error(`Unsupported value at "${prefix}"`)
}

const flattenObject = (input: Record<string, unknown>): Entry[] => {
  const out: Entry[] = []

  Object.entries(input).forEach(([key, value]) => {
    flattenValue(key, value, out)
  })

  return out
}

const parseAzureAppSettings = (text: string): Entry[] => {
  if (!text.trim()) {
    return []
  }

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error('Azure app settings input must be a JSON array.')
  }

  const entries: Entry[] = parsed.map((item, index) => {
    if (!isRecord(item) || typeof item.name !== 'string') {
      throw new Error(`Invalid Azure app setting at index ${index}.`)
    }

    return {
      key: item.name,
      value: String(item.value ?? ''),
    }
  })

  return dedupeEntries(entries)
}

const unquoteOneLayer = (value: string): string => {
  if (value.length >= 2) {
    const firstChar = value[0]
    const lastChar = value[value.length - 1]
    if (
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === "'" && lastChar === "'")
    ) {
      return value.slice(1, -1)
    }
  }

  return value
}

const parseEnv = (text: string): Entry[] => {
  if (!text.trim()) {
    return []
  }

  const entries: Entry[] = []
  const lines = text.split(/\r?\n/)

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      return
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      throw new Error(`Invalid .env line ${index + 1}. Expected KEY=VALUE.`)
    }

    const key = line.slice(0, separatorIndex).trim()
    const valueRaw = line.slice(separatorIndex + 1).trim()
    entries.push({ key, value: unquoteOneLayer(valueRaw) })
  })

  return dedupeEntries(entries)
}

const parseAppSettingsJson = (text: string): Entry[] => {
  if (!text.trim()) {
    return []
  }

  const parsed = JSON.parse(text)
  if (!isRecord(parsed)) {
    throw new Error('appsettings.json input must be a JSON object.')
  }

  return dedupeEntries(flattenObject(parsed))
}

const parseLocalSettingsJson = (text: string): Entry[] => {
  if (!text.trim()) {
    return []
  }

  const parsed = JSON.parse(text)
  if (!isRecord(parsed) || !isRecord(parsed.Values)) {
    throw new Error(
      'local.settings.json input must be a JSON object with a "Values" object.',
    )
  }

  return dedupeEntries(flattenObject(parsed.Values))
}

const toObject = (entries: Entry[]): Record<string, PrimitiveValue> => {
  const output: Record<string, PrimitiveValue> = {}
  for (const entry of entries) {
    output[entry.key] = entry.value
  }
  return output
}

const isArrayIndexSegment = (segment: string): boolean => /^\d+$/.test(segment)

const setNestedValue = (
  root: Record<string, unknown>,
  flatKey: string,
  value: PrimitiveValue,
): void => {
  const segments = flatKey.split('__').filter(Boolean)
  if (!segments.length) {
    return
  }

  let current: unknown = root

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    const isLast = i === segments.length - 1
    const nextSegment = segments[i + 1]
    const nextShouldBeArray = nextSegment ? isArrayIndexSegment(nextSegment) : false

    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0) {
        return
      }

      if (isLast) {
        current[index] = value
        return
      }

      const existing = current[index]
      if (
        !existing ||
        (nextShouldBeArray && !Array.isArray(existing)) ||
        (!nextShouldBeArray && (typeof existing !== 'object' || existing === null || Array.isArray(existing)))
      ) {
        current[index] = nextShouldBeArray ? [] : {}
      }
      current = current[index]
      continue
    }

    if (typeof current !== 'object' || current === null) {
      return
    }

    const obj = current as Record<string, unknown>
    if (isLast) {
      obj[segment] = value
      return
    }

    const existing = obj[segment]
    if (
      !existing ||
      (nextShouldBeArray && !Array.isArray(existing)) ||
      (!nextShouldBeArray && (typeof existing !== 'object' || existing === null || Array.isArray(existing)))
    ) {
      obj[segment] = nextShouldBeArray ? [] : {}
    }
    current = obj[segment]
  }
}

const toNestedObject = (entries: Entry[]): Record<string, unknown> => {
  const output: Record<string, unknown> = {}

  for (const entry of entries) {
    setNestedValue(output, entry.key, entry.value)
  }

  return output
}

const renderAzureAppSettings = (entries: Entry[]): string =>
  JSON.stringify(
    entries.map(({ key, value }) => ({
      name: key,
      value: String(value ?? ''),
      slotSetting: false,
    })),
    null,
    2,
  )

const renderEnv = (entries: Entry[]): string =>
  entries.map(({ key, value }) => `${key}=${String(value ?? '')}`).join('\n')

const renderAppSettingsJson = (entries: Entry[]): string =>
  JSON.stringify(toNestedObject(entries), null, 2)

const renderLocalSettingsJson = (entries: Entry[]): string =>
  JSON.stringify({ Values: toObject(entries) }, null, 2)

export const parseByFormat = (text: string, format: Format): Entry[] => {
  switch (format) {
    case FormatId.AzureAppSettings:
      return parseAzureAppSettings(text)
    case FormatId.DotEnv:
      return parseEnv(text)
    case FormatId.AppSettingsJson:
      return parseAppSettingsJson(text)
    case FormatId.LocalSettingsJson:
      return parseLocalSettingsJson(text)
    default:
      throw new Error(`Unsupported input format: ${format}`)
  }
}

export const renderByFormat = (entries: Entry[], format: Format): string => {
  const normalized = dedupeEntries(entries)

  switch (format) {
    case FormatId.AzureAppSettings:
      return renderAzureAppSettings(normalized)
    case FormatId.DotEnv:
      return renderEnv(normalized)
    case FormatId.AppSettingsJson:
      return renderAppSettingsJson(normalized)
    case FormatId.LocalSettingsJson:
      return renderLocalSettingsJson(normalized)
    default:
      throw new Error(`Unsupported output format: ${format}`)
  }
}

export const getSampleInput = (format: Format): string => {
  switch (format) {
    case FormatId.AzureAppSettings:
      return `[
  {
    "name": "Sql__ConnectionString",
    "value": "Server=localhost,1433;Database=Employees;Trusted_Connection=True;",
    "slotSetting": false
  },
  {
    "name": "UnilateralPhaseDetectors",
    "value": "7",
    "slotSetting": false
  },
  {
    "name": "KaraokeMode__Enabled",
    "value": "true",
    "slotSetting": false
  },
  {
    "name": "KaraokeMode__Lyrics__0",
    "value": "We're no strangers to love",
    "slotSetting": false
  },
  {
    "name": "KaraokeMode__Lyrics__1",
    "value": "You know the rules, and so do I",
    "slotSetting": false
  },
  {
    "name": "KaraokeMode__Lyrics__2",
    "value": "A full commitment's what I'm thinking of",
    "slotSetting": false
  }
]`
    case FormatId.AppSettingsJson:
      return `{
  "Sql": {
    "ConnectionString": "Server=localhost,1433;Database=Employees;Trusted_Connection=True;"
  },
  "UnilateralPhaseDetectors": 7,
  "KaraokeMode": {
    "Enabled": true,
    "Lyrics": [
      "We're no strangers to love",
      "You know the rules, and so do I",
      "A full commitment's what I'm thinking of"
    ]
  }
}`
    case FormatId.LocalSettingsJson:
      return `{
  "Values": {
    "Sql__ConnectionString": "Server=localhost,1433;Database=Employees;Trusted_Connection=True;",
    "UnilateralPhaseDetectors": 7,
    "KaraokeMode__Enabled": true,
    "KaraokeMode__Lyrics__0": "We're no strangers to love",
    "KaraokeMode__Lyrics__1": "You know the rules, and so do I",
    "KaraokeMode__Lyrics__2": "A full commitment's what I'm thinking of"
  }
}`
    case FormatId.DotEnv:
      return `Sql__ConnectionString=Server=localhost,1433;Database=Employees;Trusted_Connection=True;
UnilateralPhaseDetectors=7
KaraokeMode__Enabled=true
KaraokeMode__Lyrics__0=We're no strangers to love
KaraokeMode__Lyrics__1=You know the rules, and so do I
KaraokeMode__Lyrics__2=A full commitment's what I'm thinking of`
    default:
      return ''
  }
}
