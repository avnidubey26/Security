const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly detail: unknown;

  constructor(
    message: string,
    status: number,
    detail: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.requestId = requestId;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload
  ) {
    const detail = (payload as { detail?: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (
            item &&
            typeof item === "object" &&
            "msg" in item &&
            typeof item.msg === "string"
          ) {
            return item.msg;
          }

          return null;
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(", ");
      }
    }
  }

  return `API request failed with status ${status}.`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const requestId =
      response.headers.get("x-request-id") ??
      (payload &&
      typeof payload === "object" &&
      "request_id" in payload &&
      typeof payload.request_id === "string"
        ? payload.request_id
        : undefined);

    throw new ApiError(
      extractErrorMessage(payload, response.status),
      response.status,
      payload,
      requestId,
    );
  }

  return payload as T;
}

export function get<T>(
  path: string,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "GET",
  });
}

export function post<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "POST",
    body,
  });
}

export function patch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "PATCH",
    body,
  });
}

export function put<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "PUT",
    body,
  });
}

export function del<T>(
  path: string,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: "DELETE",
  });
}

export const api = {
  get,
  post,
  patch,
  put,
  delete: del,
};