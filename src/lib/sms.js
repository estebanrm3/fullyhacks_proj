// Calls Twilio REST API directly from the browser.
// Uses VITE_TWILIO_* vars so it works in local dev AND on Vercel.

export async function sendSMS(to, message) {
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID
  const authToken  = import.meta.env.VITE_TWILIO_AUTH_TOKEN
  const from       = import.meta.env.VITE_TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    console.warn('[sms] Twilio not configured — add VITE_TWILIO_* vars to .env.local')
    return
  }

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
      }
    )
    if (!resp.ok) {
      const err = await resp.json()
      throw new Error(err.message)
    }
    console.log('[sms] Alert sent to', to)
  } catch (err) {
    console.error('[sms] Failed to send:', err.message)
  }
}
