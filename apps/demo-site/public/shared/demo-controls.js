/*
 * Demo-only switches for the static deployment (the local demo server has /break and /deploy/v2 for this).
 *
 *   ?broken=1   simulate a production defect: the checkout button throws when clicked
 *
 * It does nothing unless the switch is in the URL, so it is safe to leave on the page.
 */
(function () {
  if (new URLSearchParams(window.location.search).get('broken') !== '1') return;
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('checkout-btn') || document.getElementById('place-order-btn');
    if (btn) {
      btn.onclick = function () {
        throw new Error('Checkout process is broken');
      };
    }
  });
})();
