import { useEffect, useMemo, useRef, useState } from 'react'
import { json } from '@codemirror/lang-json'
import {
  HighlightStyle,
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { Prec } from '@codemirror/state'
import CodeMirror from '@uiw/react-codemirror'
import { tags } from '@lezer/highlight'
import { CheckIcon, ChevronDownIcon, ClipboardIcon, ResetIcon } from './icons'
import {
  coerceEntriesForTypedOutput,
  FormatId,
  formatLabelById,
  formatOptions,
  getSampleInput,
  parseByFormat,
  renderByFormat,
  type Format,
} from './formatters'

const darkJsonHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [tags.bool, tags.atom, tags.keyword], color: '#93c5fd' },
  ]),
)
const defaultSyntaxHighlight = syntaxHighlighting(defaultHighlightStyle)
const APP_TITLE = '.NET Settings Thing'

type FormatSelectProps = {
  ariaLabel: string
  onChange: (format: Format) => void
  value: Format
}

const FormatSelect = ({ ariaLabel, onChange, value }: FormatSelectProps) => (
  <div className="relative">
    <select
      aria-label={ariaLabel}
      className="appearance-none rounded-md border border-slate-300 bg-white px-2 py-1 pr-8 text-sm text-slate-900 outline-none ring-slate-400 transition focus:ring-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
      onChange={(event) => onChange(event.target.value as Format)}
      value={value}
    >
      {formatOptions.map((option) => (
        <option key={option} value={option}>
          {formatLabelById[option]}
        </option>
      ))}
    </select>
    <ChevronDownIcon />
  </div>
)

const getEditorExtensions = (format: Format, isDarkMode: boolean) => {
  const darkExtensions = isDarkMode
    ? [defaultSyntaxHighlight, Prec.highest(darkJsonHighlight)]
    : []

  switch (format) {
    case FormatId.AzureAppSettings:
    case FormatId.AppSettingsJson:
    case FormatId.LocalSettingsJson:
      return [json(), ...darkExtensions]
    case FormatId.DotEnv:
      return darkExtensions
    default:
      return darkExtensions
  }
}

function App() {
  const [inputText, setInputText] = useState(getSampleInput(formatOptions[1]))
  const [inputFormat, setInputFormat] = useState<Format>(formatOptions[1])
  const [outputFormat, setOutputFormat] = useState<Format>(formatOptions[0])
  const [justCopied, setJustCopied] = useState(false)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => setIsDarkMode(event.matches)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    },
    [],
  )

  const conversionResult = useMemo(() => {
    try {
      const entries = parseByFormat(inputText, inputFormat)
      const normalizedEntries = coerceEntriesForTypedOutput(
        entries,
        inputFormat,
        outputFormat,
      )
      return {
        outputText: renderByFormat(normalizedEntries, outputFormat),
        parseError: '',
      }
    } catch (error) {
      return {
        outputText: '',
        parseError:
          error instanceof Error ? error.message : 'Unable to parse input.',
      }
    }
  }, [inputText, inputFormat, outputFormat])

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(conversionResult.outputText)
      setJustCopied(true)
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setJustCopied(false)
        copyResetTimeoutRef.current = null
      }, 1200)
    } catch {
      // Ignore clipboard failures for now.
    }
  }

  return (
    <div className="h-screen bg-slate-400 dark:bg-slate-950">
      <main className="mx-auto flex h-full min-h-[32rem] w-full max-w-7xl flex-col bg-slate-100 px-4 py-10 dark:bg-slate-700 sm:px-6 lg:px-8">
        <h1 className="mx-auto pb-2 text-slate-900 dark:text-slate-100">{APP_TITLE}</h1>
        <div className="grid h-full min-h-0 auto-rows-fr gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,60ch),1fr))]">
          <section className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <FormatSelect
                ariaLabel="Input format"
                onChange={(nextFormat) => {
                  const currentSample = getSampleInput(inputFormat)
                  const hasOnlySampleOrEmpty =
                    !inputText.trim() || inputText === currentSample

                  if (hasOnlySampleOrEmpty) {
                    setInputText(getSampleInput(nextFormat))
                  }
                  setInputFormat(nextFormat)
                }}
                value={inputFormat}
              />
              <button
                aria-label="Reset input to sample"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setInputText(getSampleInput(inputFormat))}
                type="button"
              >
                <ResetIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm dark:border-slate-500 dark:bg-slate-800">
              <CodeMirror
                aria-label="Input text"
                className="h-full text-slate-900 dark:text-slate-100"
                extensions={getEditorExtensions(inputFormat, isDarkMode)}
                height="100%"
                id="input-text"
                onChange={(value) => setInputText(value)}
                value={inputText}
              />
            </div>
            {conversionResult.parseError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                {conversionResult.parseError}
              </p>
            ) : null}
          </section>

          <section className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <FormatSelect
                ariaLabel="Output format"
                onChange={setOutputFormat}
                value={outputFormat}
              />
              <button
                aria-label="Copy output"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={handleCopyOutput}
                type="button"
              >
                {justCopied ? <CheckIcon /> : <ClipboardIcon />}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-300 bg-slate-50 shadow-sm dark:border-slate-500 dark:bg-slate-900">
              <CodeMirror
                aria-label="Output text"
                className="h-full text-slate-900 dark:text-slate-100"
                editable={false}
                extensions={getEditorExtensions(outputFormat, isDarkMode)}
                height="100%"
                id="output-text"
                value={conversionResult.outputText}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
