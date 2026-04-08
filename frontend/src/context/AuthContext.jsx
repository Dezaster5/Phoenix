import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  token: "phoenixToken",
  role: "phoenixRole",
  isSuperuser: "phoenixIsSuperuser",
  portalLogin: "phoenixPortalLogin",
  userId: "phoenixUserId",
  departmentId: "phoenixDepartmentId",
  fullName: "phoenixFullName",
  department: "phoenixDepartment"
};

function readStoredAuth() {
  return {
    token: localStorage.getItem(STORAGE_KEYS.token) || "",
    role: localStorage.getItem(STORAGE_KEYS.role) || "employee",
    isSuperuser: localStorage.getItem(STORAGE_KEYS.isSuperuser) === "1",
    viewerLogin: localStorage.getItem(STORAGE_KEYS.portalLogin) || "",
    viewerUserId: Number(localStorage.getItem(STORAGE_KEYS.userId) || 0),
    viewerDepartmentId: Number(localStorage.getItem(STORAGE_KEYS.departmentId) || 0),
    viewerFullName: localStorage.getItem(STORAGE_KEYS.fullName) || "",
    viewerDepartment: localStorage.getItem(STORAGE_KEYS.department) || "Без отдела"
  };
}

function persistAuthState(authState) {
  localStorage.setItem(STORAGE_KEYS.token, authState.token || "");
  localStorage.setItem(STORAGE_KEYS.role, authState.role || "employee");
  localStorage.setItem(STORAGE_KEYS.isSuperuser, authState.isSuperuser ? "1" : "0");
  localStorage.setItem(STORAGE_KEYS.portalLogin, authState.viewerLogin || "");
  localStorage.setItem(STORAGE_KEYS.userId, String(authState.viewerUserId || 0));
  localStorage.setItem(STORAGE_KEYS.departmentId, String(authState.viewerDepartmentId || 0));
  localStorage.setItem(STORAGE_KEYS.fullName, authState.viewerFullName || "");
  localStorage.setItem(STORAGE_KEYS.department, authState.viewerDepartment || "Без отдела");
}

function clearStoredAuth() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

function buildAuthStateFromPayload(payload, currentState = readStoredAuth()) {
  return {
    token: payload.token ?? currentState.token ?? "",
    role: payload.role ?? currentState.role ?? "employee",
    isSuperuser: Boolean(payload.is_superuser ?? currentState.isSuperuser),
    viewerLogin: payload.portal_login ?? currentState.viewerLogin ?? "",
    viewerUserId: Number(payload.id ?? currentState.viewerUserId ?? 0),
    viewerDepartmentId: Number(payload.department?.id ?? currentState.viewerDepartmentId ?? 0),
    viewerFullName:
      payload.full_name || payload.portal_login || currentState.viewerFullName || "",
    viewerDepartment: payload.department?.name || currentState.viewerDepartment || "Без отдела"
  };
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth);

  const applyAuthPayload = (payload) => {
    setAuthState((currentState) => {
      const nextState = buildAuthStateFromPayload(payload, currentState);
      persistAuthState(nextState);
      return nextState;
    });
  };

  const logout = () => {
    clearStoredAuth();
    setAuthState({
      token: "",
      role: "employee",
      isSuperuser: false,
      viewerLogin: "",
      viewerUserId: 0,
      viewerDepartmentId: 0,
      viewerFullName: "",
      viewerDepartment: "Без отдела"
    });
  };

  const value = useMemo(
    () => ({
      ...authState,
      isAuthenticated: Boolean(authState.token),
      applyAuthPayload,
      logout
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
