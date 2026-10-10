export function Conflicts() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Conflicts</h1>
      <div className="bg-white p-12 rounded-lg border shadow-sm text-center text-slate-500">
        <h3 className="text-lg font-medium mb-2">No Conflicts Detected</h3>
        <p className="max-w-md mx-auto">
          Currently, there are no overlapping patches. When patches modify the same element and property, they will appear here for side-by-side merging.
        </p>
      </div>
    </div>
  );
}
