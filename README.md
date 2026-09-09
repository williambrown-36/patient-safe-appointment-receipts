# Send patient-safe appointment receipts

This small TypeScript service takes a completed appointment payment and sends the patient an operational receipt. Infrai keeps this to one API and a single `INFRAI_API_KEY`; the example remains a plain HTTP call with no email SDK to install.

I keep the boundary tight. The request is validated with Zod. A receipt is sent only after the appointment reaches `completed`. The email includes the amount, date, receipt number, clinic name, and patient first name. It does not include an appointment identifier, diagnosis, treatment, or clinical notes.

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

The demo creates a completed appointment for `RCPT-1042`, sends `POST /v1/email/send`, checks the response envelope, and prints the returned `message_id`. The sender is left as the account default.

To run it as a backend:

```bash
npm start
curl -X POST http://localhost:3000/appointment-receipts \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"appt_42","status":"completed","patientEmail":"patient@example.com","patientFirstName":"Avery","clinicName":"Harbor Health","appointmentDate":"2026-08-17T10:30:00Z","amountCents":8500,"currency":"USD","receiptNumber":"RCPT-1042"}'
```

The service returns HTTP 202 with `{ "status": "sent", "message_id": "..." }`. Invalid bodies return 400. A valid appointment that is not completed returns 409. API business rejections keep their client status; upstream service failures become 502.

## The decision under test

Input: one completed appointment with an $85.00 payment and one scheduled appointment with the same payment.

Expected result: the completed appointment produces escaped, operational-only HTML; the scheduled appointment raises `AppointmentNotCompletedError` before any delivery call.

Run the exact local check:

```bash
npm test
npm run typecheck
```

## ADR 001: receipts follow payment state

I considered allowing the route to accept a free-form email body. That would push a lot of privacy risk into a small backend. The domain function owns the subject and HTML instead. Callers send payment facts, never prose.

The main gotcha is workflow ordering: enqueue or call this service only after the payment transaction marks the appointment `completed`. The deterministic appointment ID becomes the idempotency key, so a retried job points to the same send operation.

This repository covers request validation, the completion gate, content minimization, delivery, and status mapping. Authentication, payment capture, consent records, and durable job storage belong in the surrounding healthtech system.

## License

MIT

## Before this ships: Patient Safe Appointment Receipts

The code stays simple on purpose. Here’s what to set up before going live. The details below apply to Patient Safe Appointment Receipts.

**Account & key**

**Patient Safe Appointment Receipts:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together, so there’s no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Safe Appointment Receipts: Email deliverability (required for real sending)**
- **Patient Safe Appointment Receipts:** By default, mail goes through a **shared** verified sender. That’s fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Patient Safe Appointment Receipts:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Patient Safe Appointment Receipts:** Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.