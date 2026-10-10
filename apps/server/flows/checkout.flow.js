export async function runCheckoutFlow(page, targetUrl) {
    // Go to the target demo site URL
    await page.goto(targetUrl);
    // Wait for the cart/checkout button to be visible. 
    // In demo site v1, it's #checkout. In v2 it's #buy-now. 
    // We use a generic locator or both since we might be testing different versions.
    // We'll try to find any button containing 'Checkout'
    const checkoutBtn = page.locator('button', { hasText: 'Checkout' });
    await checkoutBtn.waitFor({ state: 'visible', timeout: 5000 });
    // Take screenshot of the checkout area (or whole page)
    const screenshot = await page.screenshot({ fullPage: true });
    return screenshot;
}
//# sourceMappingURL=checkout.flow.js.map