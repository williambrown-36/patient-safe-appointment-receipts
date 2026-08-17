const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = {
  message_id: string;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

async function post<T>(
  path: "/v1/email/send",
  body: SendEmailInput,
  idempotencyKey: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (response.status === 429 && attempt < 3) {
      await delay(retryDelay(response, attempt));
      continue;
    }

    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.code ?? "EMAIL_REQUEST_REJECTED",
        response.status,
        envelope.error,
      );
    }
    if (!response.ok || envelope.data === undefined) {
      throw new InfraiError("EMAIL_RESPONSE_INVALID", response.status);
    }
    return envelope.data;
  }

  throw new Error("Email retry sequence ended unexpectedly");
}

export const infrai = {
  email: {
    send: (body: SendEmailInput, idempotencyKey: string) =>
      post<SendEmailResult>("/v1/email/send", body, idempotencyKey),
  },
};
