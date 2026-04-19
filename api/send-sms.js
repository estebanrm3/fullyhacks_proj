// Vercel serverless function — POST /api/send-sms
// Sends an SMS via Twilio REST API.
// Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, message } = req.body ?? {}
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, message' })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    console.error('[send-sms] Twilio env vars not configured')
    return res.status(500).json({ error: 'SMS service not configured' })
  }

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
      }
    )

    const data = await resp.json()
    if (!resp.ok) throw new Error(data.message ?? `Twilio error ${resp.status}`)

    return res.status(200).json({ ok: true, sid: data.sid })
  } catch (err) {
    console.error('[send-sms] Twilio request failed:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
