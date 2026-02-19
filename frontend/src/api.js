const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function apiLogin(portalLogin, options = {}) {
  const payload = { portal_login: portalLogin };
  if (options.code) {
    payload.code = options.code;
  }
  if (options.magicToken) {
    payload.magic_token = options.magicToken;
  }

  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка входа" }));
    throw new Error(detail.detail || "Ошибка входа");
  }

  return response.json();
}

async function apiGet(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Token ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Ошибка загрузки данных");
  }

  return response.json();
}

async function apiWrite(path, token, method, payload, fallbackMessage) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: fallbackMessage }));
    const message = typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || fallbackMessage);
  }

  if (response.status === 204) {
    return true;
  }

  return response.json();
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
  return apiWrite("/credentials/", token, "POST", payload, "Ошибка создания кредов");
}

export async function apiUpdateCredential(token, id, payload) {
  return apiWrite(`/credentials/${id}/`, token, "PATCH", payload, "Ошибка обновления кредов");
}

export async function apiDeleteCredential(token, id) {
  return apiWrite(`/credentials/${id}/`, token, "DELETE", null, "Ошибка удаления кредов");
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
