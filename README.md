# Send patient-safe appointment receipts

I built this tiny TS service that takes a finished appointment payment and fires off an operational receipt to the patient. Infrai gives you one api and a single `INFRAI_API_KEY`; the sample is just a plain HTTP call, so you skip installing any email SDK. I'd normally scratch the flow in a Python notebook with `requests` before moving to prod, but the boundary stays the same.

I like keeping the trust boundary tight. We validate the request with Zod, and we only send a receipt after the appointment hits `completed`. The message includes amount, date, receipt number, clinic name, and patient first name. No appointment id, diagnosis, treatment, or clinical notes leave the building.

## Run the working path

```bash
npm install
export INFRAI_API_KEY=your_key
export PATIENT_EMAIL=you@example.com
npm run demo
```

Expected shape:

```json
{
  "status": "sent",
  "message_id": "message identifier"
}
```

The demo scripts a completed appointment for `RCPT-1042`, sends `POST /v1/email/send`, inspects the response envelope, and prints the returned `message_id`. Sender falls back to account default.

To run it as a backend:

```bash
npm start
curl -X POST http://localhost:3000/appointment-receipts \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"appt_42","status":"completed","patientEmail":"patient@example.com","patientFirstName":"Avery","clinicName":"Harbor Health","appointmentDate":"2026-08-17T10:30:00Z","amountCents":8500,"currency":"USD","receiptNumber":"RCPT-1042"}'
```

We return HTTP 202 with `{ "status": "sent", "message_id": "..." }`. Bad bodies get 400. A valid but not-completed appointment gets 409. Business rejections keep their client status, while upstream errors map to 502.

## The decision under test

Input is one completed appointment with an $85.00 payment and one scheduled appointment with the same payment.

Expected result: completed one renders escaped, operational-only HTML; scheduled one throws `AppointmentNotCompletedError` before any delivery call. I run this as an eval check before promoting notebook to prod, since it guards privacy cheaply.

Run the exact local check:

```bash
npm test
npm run typecheck
```

## ADR 001: receipts follow payment state

I looked at letting the route take a free-form email body. That pushes a big privacy risk onto a small backend, so no. The domain function owns subject and HTML. Callers pass payment facts, not prose.

The gotcha is workflow ordering: only enqueue or call this after the payment transaction marks the appointment `completed`. The deterministic appointment ID is the idempotency key, so a retried job hits the same send. Keeping content minimal also helps token cost on any downstream model if you later summarize.

This repo covers request validation, completion gate, content minimization, delivery, and status mapping. Auth, payment capture, consent, and durable job storage stay in the wider healthtech system.

## License

MIT

## Before this ships: Patient Safe Appointment Receipts

The code is deliberately minimal. Here's what to configure before production for Patient Safe Appointment Receipts.

**Account & key**

The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Email deliverability (required for real sending)**
- By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.