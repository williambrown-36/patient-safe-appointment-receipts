import { z } from "zod";
import { infrai, type SendEmailResult } from "./infrai_email.js";

export const receiptRequestSchema = z.object({
  appointmentId: z.string().min(1).max(80),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  patientEmail: z.string().email(),
  patientFirstName: z.string().min(1).max(80),
  clinicName: z.string().min(1).max(120),
  appointmentDate: z.string().datetime({ offset: true }),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  receiptNumber: z.string().min(1).max(80),
});

export type ReceiptRequest = z.infer<typeof receiptRequestSchema>;

export class AppointmentNotCompletedError extends Error {
  constructor() {
    super("A receipt can only be sent for a completed appointment");
    this.name = "AppointmentNotCompletedError";
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export function buildReceiptEmail(input: ReceiptRequest) {
  if (input.status !== "completed") throw new AppointmentNotCompletedError();

  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: input.currency,
  }).format(input.amountCents / 100);
  const appointmentDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(input.appointmentDate));

  return {
    to: input.patientEmail,
    subject: `Receipt ${input.receiptNumber} from ${input.clinicName}`,
    html: [
      `<p>Hello ${escapeHtml(input.patientFirstName)},</p>`,
      `<p>We received ${escapeHtml(amount)} for your appointment on ${escapeHtml(appointmentDate)}.</p>`,
      `<p>Receipt: ${escapeHtml(input.receiptNumber)}</p>`,
      `<p>${escapeHtml(input.clinicName)}</p>`,
    ].join(""),
  };
}

export async function sendAppointmentReceipt(
  input: ReceiptRequest,
): Promise<SendEmailResult> {
  const email = buildReceiptEmail(input);
  return infrai.email.send(email, `appointment-receipt:${input.appointmentId}`);
}
