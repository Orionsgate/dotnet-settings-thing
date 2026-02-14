import { useEffect, useState } from 'react'
import {
  formatOptions,
  getSampleInput,
  parseByFormat,
  renderByFormat,
  type Format,
} from './formatters'

function App() {
  const [inputText, setInputText] = useState('')
  const [inputFormat, setInputFormat] = useState<Format>(formatOptions[0])
  const [outputFormat, setOutputFormat] = useState<Format>(formatOptions[0])
  const [outputText, setOutputText] = useState('')
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    try {
      const entries = parseByFormat(inputText, inputFormat)
      const rendered = renderByFormat(entries, outputFormat)
      setOutputText(rendered)
      setParseError('')
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Unable to parse input.')
    }
  }, [inputText, inputFormat, outputFormat])

  return (
    <div className="h-screen bg-slate-400 dark:bg-slate-950">
      <main className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col bg-slate-100 px-4 py-10 dark:bg-slate-700 sm:px-6 lg:px-8">
        <div className="flex h-full min-h-0 flex-wrap content-stretch gap-6">
          <section className="flex min-h-0 min-w-[min(100%,60ch)] flex-1 basis-[60ch] flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
                htmlFor="input-text"
              >
                Input
              </label>
              <select
                aria-label="Input format"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none ring-slate-400 transition focus:ring-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
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
            </div>
            <textarea
              id="input-text"
              className="min-h-0 flex-1 w-full resize-y rounded-md border border-slate-300 bg-white p-3 font-mono text-slate-900 shadow-sm outline-none ring-slate-400 transition focus:ring-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
              onChange={(event) => setInputText(event.target.value)}
              placeholder="Type here..."
              value={inputText}
            />
            {parseError ? (
              <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
            ) : null}
          </section>

          <section className="flex min-h-0 min-w-[min(100%,60ch)] flex-1 basis-[60ch] flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
                htmlFor="output-text"
              >
                Output
              </label>
              <select
                aria-label="Output format"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none ring-slate-400 transition focus:ring-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                onChange={(event) => setOutputFormat(event.target.value as Format)}
                value={outputFormat}
              >
                {formatOptions.map((option) => (
                  <option key={`output-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id="output-text"
              className="min-h-0 flex-1 w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-slate-900 shadow-sm outline-none dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              readOnly
              value={outputText}
            />
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
