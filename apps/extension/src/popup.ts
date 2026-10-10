document.getElementById('toggle-preview')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Trigger preview mode banner via custom event
        window.dispatchEvent(new CustomEvent('PATCHWORK_TOGGLE_PREVIEW'));
      }
    });
  }
});
