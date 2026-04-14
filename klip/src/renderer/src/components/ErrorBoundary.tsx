import React, { type ReactNode } from 'react'
import { AlertCircle, RefreshCw, Copy, Check } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  copied: boolean
}

/**
 * Global React error boundary. Catches unhandled render errors anywhere in the
 * component tree and shows a full-screen crash recovery UI instead of a blank page.
 *
 * Wrap the app root with this once — it doesn't need to be nested.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log to console so Electron's devtools can capture it
    console.error('[Klip] Uncaught render error:', error.message)
    console.error(error.stack)
    console.error('Component stack:', info.componentStack)
  }

  handleCopy = (): void => {
    const { error } = this.state
    if (!error) return
    const text = [
      `${error.name}: ${error.message}`,
      '',
      error.stack ?? '(no stack trace)'
    ].join('\n')
    navigator.clipboard.writeText(text).catch(() => {
      // Clipboard may not be available in some contexts — silently ignore
    })
    this.setState({ copied: true })
    setTimeout(() => this.setState({ copied: false }), 2000)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { error, copied } = this.state

    if (!error) return this.props.children

    const errorText = [
      `${error.name}: ${error.message}`,
      '',
      error.stack ?? '(no stack trace)'
    ].join('\n')

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-6 max-w-[500px] w-full px-6">

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-900/50 flex items-center justify-center shrink-0">
            <AlertCircle size={26} className="text-red-400" />
          </div>

          {/* Title + description */}
          <div className="text-center flex flex-col gap-2">
            <h1 className="text-[var(--text-primary)] font-semibold text-base tracking-tight">
              Something went wrong
            </h1>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed max-w-[380px]">
              Klip encountered an unexpected error and cannot continue. Your project is
              auto-saved every 2&nbsp;minutes — reload to restore your most recent work.
            </p>
          </div>

          {/* Error details box */}
          <div className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border-subtle)]">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                Error Details
              </span>
              <button
                onClick={this.handleCopy}
                className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-100"
              >
                {copied
                  ? <Check size={11} className="text-green-400" />
                  : <Copy size={11} />
                }
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="px-3.5 py-3 text-[11px] font-mono text-red-300/90 overflow-auto max-h-[200px] leading-relaxed whitespace-pre-wrap break-all select-text">
              {errorText}
            </pre>
          </div>

          {/* Reload button */}
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors duration-100 active:scale-[0.97]"
          >
            <RefreshCw size={14} />
            Reload Klip
          </button>

          {/* Hint */}
          <p className="text-[11px] text-[var(--text-disabled)] text-center -mt-2">
            If this keeps happening, copy the error above and report it.
          </p>
        </div>
      </div>
    )
  }
}
