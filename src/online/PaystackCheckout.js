/**
 * v0.51: Paystack checkout for billboard ads (TEST MODE). The server starts the transaction with the secret key and
 * hands back an access code; this opens Paystack's own payment popup (their script, loaded from js.paystack.co). If
 * the popup can't load, the Paystack payment page opens in a new tab instead. Either way the server asks Paystack
 * whether the payment went through before the flyer goes up.
 */
let loading = null;
export function loadPaystack() {
  if (globalThis.PaystackPop) return Promise.resolve(globalThis.PaystackPop);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = 'https://js.paystack.co/v2/inline.js'; s.async = true;
    s.onload = () => globalThis.PaystackPop ? resolve(globalThis.PaystackPop) : reject(Error('Paystack did not load.'));
    s.onerror = () => { loading = null; s.remove(); reject(Error('Could not load Paystack (are you online?).')); };
    setTimeout(() => { if (!globalThis.PaystackPop) { loading = null; reject(Error('Paystack took too long to load.')); } }, 15000);
    document.head.append(s);
  });
  return loading;
}

/** Start paying for an ad. Resolves with { paid } after the server has checked with Paystack. */
export async function payForAd(online, ad, email) {
  const start = await online.request('adPayStart', { id: ad.id, email, returnUrl: location.href });
  if (start.paid) return { paid: true };
  let Pop = null; try { Pop = await loadPaystack(); } catch { Pop = null; }
  if (!Pop) { // fall back to the Paystack payment page
    window.open(start.authorizationUrl, '_blank', 'noopener');
    return { paid: false, redirected: true, message: 'The Paystack page opened in a new tab. Pay there, then tap "I have paid — check".' };
  }
  const outcome = await new Promise((resolve) => {
    try {
      const pop = new Pop();
      pop.resumeTransaction(start.accessCode, { onSuccess: () => resolve('success'), onCancel: () => resolve('cancel'), onError: () => resolve('error') });
    } catch { resolve('error'); }
  });
  if (outcome === 'cancel') return { paid: false, message: 'Payment window closed. Nothing was charged; you can try again.' };
  if (outcome === 'error') { window.open(start.authorizationUrl, '_blank', 'noopener'); return { paid: false, redirected: true, message: 'The popup had a problem, so the Paystack page opened in a new tab. Pay there, then tap "I have paid — check".' }; }
  const check = await online.request('adPayCheck', { id: ad.id });
  return { paid: !!check.paid, message: check.message };
}
/** Coming back from the Paystack page (?ow_ad=…&reference=…): check that ad once, then tidy the address bar. */
export function returningAd() { try { const u = new URL(location.href), id = u.searchParams.get('ow_ad'); if (!id) return null; u.searchParams.delete('ow_ad'); u.searchParams.delete('reference'); u.searchParams.delete('trxref'); history.replaceState(null, '', u.href); return id; } catch { return null; } }
