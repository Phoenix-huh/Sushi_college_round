import { Page } from "playwright";

export async function runCheckoutFlow(page: Page, targetUrl: string): Promise<Buffer> {
  await page.goto(targetUrl);
  await page.waitForLoadState("domcontentloaded");

  const checkoutBtn = page.locator("#checkout-btn, #place-order-btn, .btn-checkout, .btn-order");
  await checkoutBtn.waitFor({ state: "visible", timeout: 4000 });

  const screenshot = await page.screenshot({ fullPage: true });
  return screenshot;
}
