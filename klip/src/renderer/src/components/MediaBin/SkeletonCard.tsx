export default function SkeletonCard(): JSX.Element {
  return (
    <div className="rounded-lg overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
      {/* Thumbnail area */}
      <div className="w-full aspect-video skeleton" />

      {/* Info area */}
      <div className="p-2 space-y-1.5">
        <div className="h-2.5 rounded skeleton w-3/4" />
        <div className="h-2 rounded skeleton w-1/2" />
      </div>
    </div>
  )
}
