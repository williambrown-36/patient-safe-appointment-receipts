import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_email.js";
import {
  AppointmentNotCompletedError,
  receiptRequestSchema,
  sendAppointmentReceipt,
} from "./receipt_sender.js";

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/appointment-receipts") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = receiptRequestSchema.parse(await readJson(request));
    const sent = await sendAppointmentReceipt(input);
    json(response, 202, { status: "sent", message_id: sent.message_id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      json(response, 400, { error: "Request body must be valid JSON" });
    } else if (error instanceof ZodError) {
      json(response, 400, { error: "Invalid receipt request", issues: error.issues });
    } else if (error instanceof AppointmentNotCompletedError) {
      json(response, 409, { error: error.message });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.message, code: error.code });
    } else {
      json(response, 500, { error: "Unexpected service error" });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Receipt service listening on http://localhost:${port}`));
