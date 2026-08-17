import assert from "node:assert/strict";
import test from "node:test";
import {
  AppointmentNotCompletedError,
  buildReceiptEmail,
  receiptRequestSchema,
} from "../src/receipt_sender.js";

const completedAppointment = receiptRequestSchema.parse({
  appointmentId: "appt_42",
  status: "completed",
  patientEmail: "patient@example.com",
  patientFirstName: "Avery <script>",
  clinicName: "Harbor Health",
  appointmentDate: "2026-08-17T10:30:00Z",
  amountCents: 8500,
  currency: "USD",
  receiptNumber: "RCPT-1042",
});

test("a completed appointment produces a minimal patient-safe receipt", () => {
  const email = buildReceiptEmail(completedAppointment);

  assert.equal(email.to, "patient@example.com");
  assert.match(email.html, /\$85\.00/);
  assert.match(email.html, /Avery &lt;script&gt;/);
  assert.doesNotMatch(email.html, /appointmentId|appt_42|diagnosis|treatment/i);
});

test("a scheduled appointment cannot produce a receipt", () => {
  assert.throws(
    () => buildReceiptEmail({ ...completedAppointment, status: "scheduled" }),
    AppointmentNotCompletedError,
  );
});
