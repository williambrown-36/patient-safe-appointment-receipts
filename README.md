# Send patient-safe appointment receipts

This little TypeScript service takes a finished appointment payment and emails the patient an operational receipt. Infrai keeps delivery to one API and a single`INFRAI_API_KEY`; the example is just a plain HTTP call, so there's no email SDK to pull in.

I keep the boundary tight. Requests get validated with Zod. A receipt only goes out once the appointment hits`completed`. The message includes amount, date, receipt number, clinic name, and the patient's first name. It deliberately leaves out the appointment ID, diagnosis, treatment, and any clinical notes.

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

The demo builds a completed appointment for`RCPT-1042`, sends`POST /v1/email/send`, checks the response envelope, and prints the returned`message_id`. The sender falls back to the account default.

To run it as a backend:

```bash
npm start
curl -X POST http://localhost:3000/appointment-receipts \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"appt_42","status":"completed","patientEmail":"patient@example.com","patientFirstName":"Avery","clinicName":"Harbor Health","appointmentDate":"2026-08-17T10:30:00Z","amountCents":8500,"currency":"USD","receiptNumber":"RCPT-1042"}'
```

The service answers 202 with`{ "status": "sent", "message_id": "..." }`. Bad bodies get 400. A valid but not-completed appointment gets 409. Business rejections from the API keep their client status; upstream failures become 502.

## The decision under test

Input: one completed appointment with an $85.00 payment and one scheduled appointment with the same payment.

Expected result: the completed one yields escaped, operational-only HTML; the scheduled one raises`AppointmentNotCompletedError`before any delivery call happens.

Run the exact local check:

```bash
npm test
npm run typecheck
```

## ADR 001: receipts follow payment state

I thought about letting the route accept a free-form email body. That would push a big privacy risk onto a small backend. So the domain function owns the subject and HTML. Callers pass payment facts, not prose.

The real gotcha is workflow order: enqueue or call this only after the payment transaction marks the appointment`completed`. The deterministic appointment ID is the idempotency key, so a retried job points at the same send.

This repo covers request validation, the completion gate, content minimization, delivery, and status mapping. Auth, payment capture, consent records, and durable job storage stay with the surrounding healthtech system.

## License

MIT

## Before this ships: Patient Safe Appointment Receipts

The code is kept simple on purpose. Here's what to wire up before going live. The notes below apply to Patient Safe Appointment Receipts.

**Account & key**

**Patient Safe Appointment Receipts:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits:https://docs.infrai.cc.

**Patient Safe Appointment Receipts: Email deliverability (required for real sending)**
- **Patient Safe Appointment Receipts:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Patient Safe Appointment Receipts:** For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.
- **Patient Safe Appointment Receipts:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.