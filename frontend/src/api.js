const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function apiLogin(portalLogin) {
  const payload = { portal_login: portalLogin };

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

export async function apiFetchCredentials(token) {
  return apiGet("/credentials/", token);
}

export async function apiFetchCategories(token) {
  return apiGet("/categories/", token);
}

export async function apiFetchUsers(token) {
  return apiGet("/users/", token);
}

export async function apiCreateUser(token, payload) {
  const response = await fetch(`${API_BASE}/users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка создания пользователя" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка создания пользователя");
  }

  return response.json();
}

export async function apiFetchServices(token) {
  return apiGet("/services/", token);
}

export async function apiFetchAccesses(token) {
  return apiGet("/accesses/", token);
}

export async function apiCreateAccess(token, payload) {
  const response = await fetch(`${API_BASE}/accesses/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка назначения доступа" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка назначения доступа");
  }

  return response.json();
}

export async function apiUpdateAccess(token, id, payload) {
  const response = await fetch(`${API_BASE}/accesses/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка обновления доступа" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка обновления доступа");
  }

  return response.json();
}

export async function apiDeleteAccess(token, id) {
  const response = await fetch(`${API_BASE}/accesses/${id}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Token ${token}`
    }
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка удаления доступа" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка удаления доступа");
  }

  return true;
}

export async function apiCreateCredential(token, payload) {
  const response = await fetch(`${API_BASE}/credentials/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка создания кредов" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка создания кредов");
  }

  return response.json();
}

export async function apiUpdateCredential(token, id, payload) {
  const response = await fetch(`${API_BASE}/credentials/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка обновления кредов" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка обновления кредов");
  }

  return response.json();
}

export async function apiDeleteCredential(token, id) {
  const response = await fetch(`${API_BASE}/credentials/${id}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Token ${token}`
    }
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Ошибка удаления кредов" }));
    const message =
      typeof detail === "object" ? detail.detail || JSON.stringify(detail) : detail;
    throw new Error(message || "Ошибка удаления кредов");
  }

  return true;
}
