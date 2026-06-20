import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { logger } from "@/shared/utils";

const SENSITIVE_FIELDS = [
  "apikey",
  "api_key",
  "api-key",
  "password",
  "token",
  "secret",
  "authorization",
  "credit_card",
  "ssn",
];

const CONTENT_FIELDS = [
  "chaptertext",
  "referencetext",
  "booktext",
  "prompt",
  "content",
  "text",
];

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function summarizeString(value: string) {
  if (value.length <= 160) {
    return value;
  }

  return `[string length=${value.length}]`;
}

function sanitize(obj: unknown, keyHint = ""): unknown {
  const normalizedKey = normalizeKey(keyHint);
  if (SENSITIVE_FIELDS.map(normalizeKey).includes(normalizedKey)) {
    return "***";
  }
  if (CONTENT_FIELDS.includes(normalizedKey)) {
    return typeof obj === "string"
      ? `[redacted text length=${obj.length}]`
      : "[redacted]";
  }
  if (typeof obj === "string") {
    return summarizeString(obj);
  }
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, keyHint));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitize(value, key);
  }

  return sanitized;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, query } = req;

    logger.info(
      `${method} ${url} - Query: ${JSON.stringify(sanitize(query))} - Body: ${JSON.stringify(sanitize(body))}`,
    );

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        logger.info(`${method} ${url} - Status: ${res.statusCode}`);
      }),
    );
  }
}
