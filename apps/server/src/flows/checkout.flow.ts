import { Page } from "playwright";

export async function runCheckoutFlow(page: Page, targetUrl: string): Promise<Buffer> {
  // Navigate to target demo store URL
  await page.goto(targetUrl);
  await page.waitForLoadState("domcontentloaded");

  // Locate the checkout button across v1 (#checkout-btn) and v2 (#place-order-btn)
  const checkoutBtn = page.locator("#checkout-btn, #place-order-btn, .btn-checkout, .btn-order");

  // Must be visible — a patch that hides or deletes the button will throw here
  await checkoutBtn.waitFor({ state: "visible", timeout: 4000 });

  // Take screenshot for visual comparison
  const screenshot = await page.screenshot({ fullPage: true });
  return screenshot;
}
