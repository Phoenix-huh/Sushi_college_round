export function Verification() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Verification Center</h1>
      <div className="bg-white p-12 rounded-lg border shadow-sm text-center text-slate-500">
        <h3 className="text-lg font-medium mb-2">Automated UI Verifier</h3>
        <p className="max-w-md mx-auto">
          Screenshots and pixel-match data for the latest deployments will appear here. Playwright flows verify critical paths (like checkout) against visual regressions.
        </p>
      </div>
    </div>
  );
}
