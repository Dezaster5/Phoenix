const API_BASE = import.meta.env.VITE_API_URL || "/api";

function buildHeaders(extra = {}) {
  return {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...extra
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    const preview = text.slice(0, 80).replace(/\s+/g, " ").trim();
    throw new Error(
      `${fallbackMessage}. Сервер вернул не JSON (content-type: ${contentType || "unknown"}${
        preview ? `, body: ${preview}` : ""
      })`
    );
  }
  return response.json();
}

function formatApiError(detail, fallbackMessage) {
  if (typeof detail === "string") return detail;
  if (!detail || typeof detail !== "object") return fallbackMessage;
  if (detail.detail) return detail.detail;
  const messages = Object.entries(detail).flatMap(([field, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => (field === "non_field_errors" ? item : `${field}: ${item}`));
  });
  return messages.join("; ") || fallbackMessage;
}

export async function apiLogin(email, password) {
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка входа").catch(() => ({
      detail: "Ошибка входа"
    }));
    throw new Error(detail.detail || "Ошибка входа");
  }

  return parseJsonResponse(response, "Ошибка входа");
}

export async function apiFetchPublicConfig() {
  const response = await fetch(`${API_BASE}/config/public/`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error("Ошибка загрузки публичной конфигурации");
  }

  return parseJsonResponse(response, "Ошибка загрузки публичной конфигурации");
}

export async function apiFetchPublicDepartments() {
  const response = await fetch(`${API_BASE}/public/departments/`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error("Ошибка загрузки отделов");
  }

  return parseJsonResponse(response, "Ошибка загрузки отделов");
}

export async function apiRegisterRequest(payload) {
  const response = await fetch(`${API_BASE}/auth/register/`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });

  if (response.status === 202) {
    return parseJsonResponse(response, "Ошибка регистрации");
  }

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка регистрации").catch(() => ({
      detail: "Ошибка регистрации"
    }));
    throw new Error(formatApiError(detail, "Ошибка регистрации"));
  }

  return parseJsonResponse(response, "Ошибка регистрации");
}

export async function apiRegisterVerify(payload) {
  const response = await fetch(`${API_BASE}/auth/register/verify/`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка подтверждения регистрации").catch(() => ({
      detail: "Ошибка подтверждения регистрации"
    }));
    throw new Error(formatApiError(detail, "Ошибка подтверждения регистрации"));
  }

  return parseJsonResponse(response, "Ошибка подтверждения регистрации");
}

export async function apiPasswordResetRequest(email) {
  const response = await fetch(`${API_BASE}/auth/password-reset/request/`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ email })
  });

  if (response.status === 202) {
    return parseJsonResponse(response, "Ошибка сброса пароля");
  }

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка сброса пароля").catch(() => ({
      detail: "Ошибка сброса пароля"
    }));
    throw new Error(formatApiError(detail, "Ошибка сброса пароля"));
  }

  return parseJsonResponse(response, "Ошибка сброса пароля");
}

export async function apiPasswordResetConfirm(payload) {
  const response = await fetch(`${API_BASE}/auth/password-reset/confirm/`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка сброса пароля").catch(() => ({
      detail: "Ошибка сброса пароля"
    }));
    throw new Error(formatApiError(detail, "Ошибка сброса пароля"));
  }

  return parseJsonResponse(response, "Ошибка сброса пароля");
}

export async function apiChangePassword(token, payload) {
  return apiWrite("/auth/password/change/", token, "POST", payload, "Ошибка смены пароля");
}

export async function apiRegisterByIin(payload) {
  const response = await fetch(`${API_BASE}/auth/register-iin/`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка регистрации").catch(() => ({
      detail: "Ошибка регистрации"
    }));
    throw new Error(formatApiError(detail, "Ошибка регистрации"));
  }

  return parseJsonResponse(response, "Ошибка регистрации");
}

async function apiGet(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders({
      Authorization: `Token ${token}`
    })
  });

  if (!response.ok) {
    throw new Error("Ошибка загрузки данных");
  }

  return parseJsonResponse(response, "Ошибка загрузки данных");
}

async function apiWrite(path, token, method, payload, fallbackMessage) {
  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
  const headers = {
    ...buildHeaders(),
    Authorization: `Token ${token}`
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload ? (isFormData ? payload : JSON.stringify(payload)) : undefined
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response, fallbackMessage).catch(() => ({
      detail: fallbackMessage
    }));
    const message = formatApiError(detail, fallbackMessage);
    throw new Error(message || fallbackMessage);
  }

  if (response.status === 204) {
    return true;
  }

  return parseJsonResponse(response, fallbackMessage);
}

export async function apiFetchMe(token) {
  return apiGet("/me/", token);
}

export async function apiFetchCredentials(token) {
  return apiGet("/credentials/", token);
}

export async function apiFetchUsers(token) {
  return apiGet("/users/", token);
}

export async function apiCreateUser(token, payload) {
  return apiWrite("/users/", token, "POST", payload, "Ошибка создания пользователя");
}

export async function apiUpdateUser(token, id, payload) {
  return apiWrite(`/users/${id}/`, token, "PATCH", payload, "Ошибка обновления пользователя");
}

export async function apiDeleteUser(token, id) {
  return apiWrite(`/users/${id}/`, token, "DELETE", null, "Ошибка деактивации пользователя");
}

export async function apiFetchServices(token) {
  return apiGet("/services/", token);
}

export async function apiFetchDepartments(token) {
  return apiGet("/departments/", token);
}

export async function apiFetchAccesses(token) {
  return apiGet("/accesses/", token);
}

export async function apiCreateAccess(token, payload) {
  return apiWrite("/accesses/", token, "POST", payload, "Ошибка назначения доступа");
}

export async function apiUpdateAccess(token, id, payload) {
  return apiWrite(`/accesses/${id}/`, token, "PATCH", payload, "Ошибка обновления доступа");
}

export async function apiDeleteAccess(token, id) {
  return apiWrite(`/accesses/${id}/`, token, "DELETE", null, "Ошибка удаления доступа");
}

export async function apiCreateCredential(token, payload) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value);
  });
  return apiWrite("/credentials/", token, "POST", formData, "Ошибка создания кредов");
}

export async function apiUpdateCredential(token, id, payload) {
  const hasFile =
    payload &&
    typeof File !== "undefined" &&
    Object.values(payload).some((value) => value instanceof File);
  if (!hasFile) {
    return apiWrite(`/credentials/${id}/`, token, "PATCH", payload, "Ошибка обновления кредов");
  }
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value);
  });
  return apiWrite(`/credentials/${id}/`, token, "PATCH", formData, "Ошибка обновления кредов");
}

export async function apiDeleteCredential(token, id) {
  return apiWrite(`/credentials/${id}/`, token, "DELETE", null, "Ошибка удаления кредов");
}

export async function apiDownloadCredentialSecret(token, id) {
  const response = await fetch(`${API_BASE}/credentials/${id}/download-secret/`, {
    method: "GET",
    headers: buildHeaders({
      Authorization: `Token ${token}`
    })
  });

  if (!response.ok) {
    const detail = await parseJsonResponse(response, "Ошибка скачивания секрета").catch(() => ({
      detail: "Ошибка скачивания секрета"
    }));
    const message = typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка скачивания секрета");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = match?.[1] || `ssh_key_${id}.key`;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function apiFetchDepartmentShares(token) {
  return apiGet("/department-shares/", token);
}

export async function apiCreateDepartmentShare(token, payload) {
  return apiWrite(
    "/department-shares/",
    token,
    "POST",
    payload,
    "Ошибка выдачи доступа к отделу"
  );
}

export async function apiUpdateDepartmentShare(token, id, payload) {
  return apiWrite(
    `/department-shares/${id}/`,
    token,
    "PATCH",
    payload,
    "Ошибка обновления доступа к отделу"
  );
}

export async function apiDeleteDepartmentShare(token, id) {
  return apiWrite(
    `/department-shares/${id}/`,
    token,
    "DELETE",
    null,
    "Ошибка удаления доступа к отделу"
  );
}

export async function apiFetchAccessRequests(token) {
  return apiGet("/access-requests/", token);
}

export async function apiFetchAuditLogs(token, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    query.append(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiGet(`/audit-logs/${suffix}`, token);
}

export async function apiExportAuditLogsCsv(token, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    query.append(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE}/audit-logs/export/${suffix}`, {
    method: "GET",
    headers: buildHeaders({
      Authorization: `Token ${token}`
    })
  });

  if (!response.ok) {
    throw new Error("Ошибка экспорта аудита");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = match?.[1] || "audit_log_export.csv";

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function apiCreateAccessRequest(token, payload) {
  return apiWrite("/access-requests/", token, "POST", payload, "Ошибка создания запроса");
}

export async function apiApproveAccessRequest(token, id, payload = {}) {
  return apiWrite(
    `/access-requests/${id}/approve/`,
    token,
    "POST",
    payload,
    "Ошибка подтверждения запроса"
  );
}

export async function apiRejectAccessRequest(token, id, payload = {}) {
  return apiWrite(
    `/access-requests/${id}/reject/`,
    token,
    "POST",
    payload,
    "Ошибка отклонения запроса"
  );
}

export async function apiCancelAccessRequest(token, id, payload = {}) {
  return apiWrite(
    `/access-requests/${id}/cancel/`,
    token,
    "POST",
    payload,
    "Ошибка отмены запроса"
  );
}
