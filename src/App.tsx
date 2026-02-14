import { useEffect, useState } from 'react'
import { json } from '@codemirror/lang-json'
import {
  HighlightStyle,
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { Prec } from '@codemirror/state'
import CodeMirror from '@uiw/react-codemirror'
import { tags } from '@lezer/highlight'
import {
  coerceEntriesForTypedOutput,
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

const getEditorExtensions = (format: Format, isDarkMode: boolean) => {
  const darkExtensions = isDarkMode
    ? [defaultSyntaxHighlight, Prec.highest(darkJsonHighlight)]
    : []

  switch (format) {
    case 'Azure app settings':
    case 'appsettings.json':
    case 'local.settings.json':
      return [json(), ...darkExtensions]
    case '.env':
      return darkExtensions
    default:
      return darkExtensions
  }
}

function App() {
  const [inputText, setInputText] = useState(getSampleInput(formatOptions[0]))
  const [inputFormat, setInputFormat] = useState<Format>(formatOptions[0])
  const [outputFormat, setOutputFormat] = useState<Format>(formatOptions[0])
  const [outputText, setOutputText] = useState('')
  const [parseError, setParseError] = useState('')
  const [justCopied, setJustCopied] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => setIsDarkMode(event.matches)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      setJustCopied(true)
      window.setTimeout(() => setJustCopied(false), 1200)
    } catch {
      // Ignore clipboard failures for now.
    }
  }

  useEffect(() => {
    try {
      const entries = parseByFormat(inputText, inputFormat)
      const normalizedEntries = coerceEntriesForTypedOutput(
        entries,
        inputFormat,
        outputFormat,
      )
      const rendered = renderByFormat(normalizedEntries, outputFormat)
      setOutputText(rendered)
      setParseError('')
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Unable to parse input.')
    }
  }, [inputText, inputFormat, outputFormat])

  return (
    <div className="h-screen bg-slate-400 dark:bg-slate-950">
      <main className="mx-auto flex h-full min-h-[32rem] w-full max-w-7xl flex-col bg-slate-100 px-4 py-10 dark:bg-slate-700 sm:px-6 lg:px-8">
        <h1 className="mx-auto text-slate-900 dark:text-slate-100 pb-2">.NET Settings Thing</h1>
        <div className="grid h-full min-h-0 auto-rows-fr gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,60ch),1fr))]">
          <section className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  aria-label="Input format"
                  className="appearance-none rounded-md border border-slate-300 bg-white px-2 py-1 pr-8 text-sm text-slate-900 outline-none ring-slate-400 transition focus:ring-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                  onChange={(event) => {
                    const nextFormat = event.target.value as Format
                    const currentSample = getSampleInput(inputFormat)
                    const hasOnlySampleOrEmpty =
                      !inputText.trim() || inputText === currentSample

                    if (hasOnlySampleOrEmpty) {
                      setInputText(getSampleInput(nextFormat))
                    }
                    setInputFormat(nextFormat)
                  }}
                  value={inputFormat}
                >
                  {formatOptions.map((option) => (
                    <option key={`input-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
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
            {parseError ? (
              <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
            ) : null}
          </section>

          <section className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="relative">
                <select
                  aria-label="Output format"
                  className="appearance-none rounded-md border border-slate-300 bg-white px-2 py-1 pr-8 text-sm text-slate-900 outline-none ring-slate-400 transition focus:ring-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                  onChange={(event) => setOutputFormat(event.target.value as Format)}
                  value={outputFormat}
                >
                  {formatOptions.map((option) => (
                    <option key={`output-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
              <button
                aria-label="Copy output"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={handleCopyOutput}
                type="button"
              >
                {justCopied ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="m20 6-11 11-5-5" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
                    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                  </svg>
                )}
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
                value={outputText}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
