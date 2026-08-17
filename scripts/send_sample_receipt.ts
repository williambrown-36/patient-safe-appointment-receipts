import { receiptRequestSchema, sendAppointmentReceipt } from "../src/receipt_sender.js";

const patientEmail = process.env.PATIENT_EMAIL;
if (!patientEmail) throw new Error("PATIENT_EMAIL is required");

const receipt = receiptRequestSchema.parse({
  appointmentId: "appt_2026_08_17_1030",
  status: "completed",
  patientEmail,
  patientFirstName: "Avery",
  clinicName: "Harbor Health",
  appointmentDate: "2026-08-17T10:30:00+08:00",
  amountCents: 8500,
  currency: "USD",
  receiptNumber: "RCPT-1042",
});

const result = await sendAppointmentReceipt(receipt);
console.log(JSON.stringify({ status: "sent", message_id: result.message_id }, null, 2));
