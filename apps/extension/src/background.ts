const SERVER_URL = 'http://localhost:4000';

// Respond to content scripts asking for patches
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PATCHES' && sender.tab?.url) {
    // Only process http pages
    if (!sender.tab.url.startsWith('http')) {
      sendResponse({ patches: [] });
      return true;
    }

    fetch(`${SERVER_URL}/deployments/live`)
      .then(res => res.json())
      .then(data => {
        const patches = data.patches || [];
        const url = new URL(sender.tab!.url!);
        const relevant = patches.filter((p: any) => {
          try {
            return new URL(p.target_url).hostname === url.hostname;
          } catch {
            return false;
          }
        });
        sendResponse({ patches: relevant });
      })
      .catch(() => {
        sendResponse({ patches: [] });
      });

    return true; // Keep the message channel open for async response
  }
});

// Handle canary error reports from content scripts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CANARY_ERROR') {
    fetch(`${SERVER_URL}/canary/error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.payload),
    }).catch(console.error);
  }
});
