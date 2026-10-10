const SERVER_URL = 'http://localhost:4000';

/**
 * Determine if this browser session is in the canary bucket.
 * Uses a stable per-session random number seeded from sessionStorage.
 */
export function isInCanaryBucket(canaryPercent: number): boolean {
  if (canaryPercent >= 100) return true;
  if (canaryPercent <= 0) return false;

  const KEY = 'patchwork_canary_seed';
  let seed = sessionStorage.getItem(KEY);
  if (!seed) {
    seed = String(Math.random());
    sessionStorage.setItem(KEY, seed);
  }
  return parseFloat(seed) * 100 < canaryPercent;
}

/**
 * Listen for uncaught errors and report them to /canary/error.
 * Should only be attached when running inside a canary deployment.
 */
export function attachCanaryErrorReporter(deploymentId: string) {
  window.addEventListener('error', (event) => {
    void chrome.runtime.sendMessage({
      type: 'CANARY_ERROR',
      payload: {
        deployment_id: deploymentId,
        error_message: event.message,
        url: window.location.href,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    void chrome.runtime.sendMessage({
      type: 'CANARY_ERROR',
      payload: {
        deployment_id: deploymentId,
        error_message: String(event.reason),
        url: window.location.href,
      },
    });
  });
}
