import { useEffect, useMemo, useState } from "react";
import {
  apiApproveAccessRequest,
  apiCancelAccessRequest,
  apiCreateCredential,
  apiCreateAccessRequest,
  apiCreateDepartmentShare,
  apiCreateUser,
  apiDownloadCredentialSecret,
  apiDeleteUser,
  apiDeleteCredential,
  apiDeleteDepartmentShare,
  apiFetchAccessRequests,
  apiFetchCredentials,
  apiFetchDepartmentShares,
  apiFetchDepartments,
  apiFetchMe,
  apiFetchServices,
  apiFetchUsers,
  apiLogin,
  apiRejectAccessRequest,
  apiUpdateUser,
  apiUpdateCredential
} from "./api";
import AdminPanel from "./components/AdminPanel";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import AuthPage from "./components/AuthPage";
import ServicesPage from "./components/ServicesPage";
import VaultPage from "./components/VaultPage";
import { demoSections } from "./data/demo";

const groupCredentialsByService = (credentials) => {
  const grouped = new Map();
  const accents = ["sky", "sunset", "mint"];

  credentials.forEach((cred) => {
    const serviceId = cred.service?.id ?? `service-${cred.id}`;
    const serviceName = cred.service?.name || "Без названия";
    const serviceUrl = cred.service?.url || "#";
    const sectionKey = String(serviceId);

    if (!grouped.has(sectionKey)) {
      grouped.set(sectionKey, {
        id: sectionKey,
        name: serviceName,
        url: serviceUrl,
        tagline: "Назначенные учётные записи",
        accent: accents[grouped.size % accents.length],
        services: []
      });
    }

    grouped.get(sectionKey).services.push({
      id: cred.id,
      name: serviceName,
      url: serviceUrl,
      login: cred.login,
      secret_type: cred.secret_type || "password",
      secret_filename: cred.secret_filename || "",
      ssh_host: cred.ssh_host || "",
      ssh_port: cred.ssh_port || 22,
      ssh_algorithm: cred.ssh_algorithm || "",
      ssh_fingerprint: cred.ssh_fingerprint || "",
      password: cred.password,
      notes: cred.notes,
      owner_login: cred.user?.portal_login || "",
      owner_name: cred.user?.full_name || "",
      owner_department: cred.user?.department?.name || "Без отдела"
    });
  });

  return Array.from(grouped.values());
};

const requestTemplate = `Здравствуйте!\n\nПрошу выдать логин для доступа в Phoenix Vault.\nФИО: ____\nОтдел: ____\nДолжность: ____\nКорпоративная почта: ____\nНужные сервисы: ____\n\nСпасибо!`;
const requestEmail = "penxren20052110@gmail.com";
const requestSubject = "Запрос логина Phoenix Vault";

const translitMap = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
};

const toLatin = (value) =>
  value
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9.\-\s_]/g, "")
    .replace(/[\s_]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");

const isHeadRole = (role) => role === "head" || role === "admin";
const ACCESS_REQUEST_STATUS_LABEL = {
  pending: "ожидает",
  approved: "одобрен",
  rejected: "отклонен",
  canceled: "отменен"
};

export default function App() {
  const [portalLogin, setPortalLogin] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("phoenixToken") || "");
  const [role, setRole] = useState(localStorage.getItem("phoenixRole") || "employee");
  const [isSuperuser, setIsSuperuser] = useState(
    () => localStorage.getItem("phoenixIsSuperuser") === "1"
  );
  const [viewerLogin, setViewerLogin] = useState(
    () => localStorage.getItem("phoenixPortalLogin") || ""
  );
  const [viewerUserId, setViewerUserId] = useState(
    () => Number(localStorage.getItem("phoenixUserId") || 0)
  );
  const [viewerDepartmentId, setViewerDepartmentId] = useState(
    () => Number(localStorage.getItem("phoenixDepartmentId") || 0)
  );
  const [viewerFullName, setViewerFullName] = useState(
    () => localStorage.getItem("phoenixFullName") || ""
  );
  const [viewerDepartment, setViewerDepartment] = useState(
    () => localStorage.getItem("phoenixDepartment") || "Без отдела"
  );
  const [sections, setSections] = useState(demoSections);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
  const [status, setStatus] = useState({ loading: false, error: "", mode: "demo" });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDepartments, setAdminDepartments] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [requestServices, setRequestServices] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [adminCredentials, setAdminCredentials] = useState([]);
  const [adminShares, setAdminShares] = useState([]);
  const [adminStatus, setAdminStatus] = useState({ loading: false, error: "", success: "" });
  const [credentialStatus, setCredentialStatus] = useState({
    loading: false,
    error: "",
    success: ""
  });
  const [shareStatus, setShareStatus] = useState({ loading: false, error: "", success: "" });
  const [accessRequestStatus, setAccessRequestStatus] = useState({
    loading: false,
    error: "",
    success: ""
  });
  const [ownRequestFilters, setOwnRequestFilters] = useState({
    status: "all",
    service: "all",
    query: ""
  });
  const [reviewRequestFilters, setReviewRequestFilters] = useState({
    status: "all",
    service: "all",
    query: ""
  });
  const [reviewComments, setReviewComments] = useState({});
  const [filters, setFilters] = useState({
    credentialService: "all"
  });
  const [credentialPage, setCredentialPage] = useState(1);
  const [editCredentialId, setEditCredentialId] = useState(null);
  const [editCredentialForm, setEditCredentialForm] = useState({
    login: "",
    secret_type: "password",
    secret_filename: "",
    ssh_host: "",
    ssh_port: 22,
    ssh_algorithm: "",
    ssh_public_key: "",
    ssh_fingerprint: "",
    password: "",
    notes: ""
  });
  const [adminForm, setAdminForm] = useState({
    portal_login: "",
    full_name: "",
    email: "",
    role: "employee",
    department_id: ""
  });
  const [credentialForm, setCredentialForm] = useState({
    user_id: "",
    service_id: "",
    login: "",
    secret_type: "password",
    secret_filename: "",
    ssh_host: "",
    ssh_port: 22,
    ssh_algorithm: "",
    ssh_public_key: "",
    ssh_fingerprint: "",
    secret_file: null,
    password: "",
    notes: ""
  });
  const [shareForm, setShareForm] = useState({
    grantee_id: "",
    expires_at: "",
    department_id: ""
  });
  const [accessRequestForm, setAccessRequestForm] = useState({
    service_id: "",
    justification: ""
  });
  const [currentView, setCurrentView] = useState(() => {
    const storedRole = localStorage.getItem("phoenixRole") || "employee";
    const storedIsSuperuser = localStorage.getItem("phoenixIsSuperuser") === "1";
    return storedIsSuperuser || isHeadRole(storedRole) ? "admin" : "vault";
  });
  const [adminTab, setAdminTab] = useState("department");

  const isAuthenticated = Boolean(token);
  const isDepartmentHead = isHeadRole(role);
  const canManage = isSuperuser || isDepartmentHead;
  const canOpenServicesTab = !canManage;
  const showVaultTab = !canManage;
  const roleLabel = isSuperuser
    ? "Супер-админ"
    : isDepartmentHead
      ? "Руководитель отдела"
      : "Сотрудник";

  useEffect(() => {
    if (!canManage && currentView === "admin") {
      setCurrentView("vault");
    }
  }, [canManage, currentView]);

  useEffect(() => {
    if (canManage && currentView !== "admin") {
      setCurrentView("admin");
    }
  }, [canManage, currentView]);

  useEffect(() => {
    if (!canOpenServicesTab && currentView === "services") {
      setCurrentView("vault");
    }
  }, [canOpenServicesTab, currentView]);

  useEffect(() => {
    const allowedTabs = new Set(["department", "shares", "requests", "self"]);
    const isSharedDepartmentTab = String(adminTab).startsWith("shared:");
    if (!allowedTabs.has(adminTab) && !isSharedDepartmentTab) {
      setAdminTab("department");
    }
  }, [adminTab]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast.visible, toast.message]);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setStatus({ loading: true, error: "", mode: "live" });
        const [credentials, me, services] = await Promise.all([
          apiFetchCredentials(token),
          apiFetchMe(token),
          apiFetchServices(token)
        ]);
        setSections(groupCredentialsByService(credentials));
        setRequestServices(Array.isArray(services) ? services : services.results || []);
        setRole(me.role);
        setIsSuperuser(Boolean(me.is_superuser));
        setViewerLogin(me.portal_login || "");
        setViewerUserId(Number(me.id || 0));
        setViewerDepartmentId(Number(me.department?.id || 0));
        setViewerFullName(me.full_name || me.portal_login || "");
        setViewerDepartment(me.department?.name || "Без отдела");
        localStorage.setItem("phoenixRole", me.role || "employee");
        localStorage.setItem("phoenixIsSuperuser", me.is_superuser ? "1" : "0");
        localStorage.setItem("phoenixPortalLogin", me.portal_login || "");
        localStorage.setItem("phoenixUserId", String(me.id || 0));
        localStorage.setItem("phoenixDepartmentId", String(me.department?.id || 0));
        localStorage.setItem("phoenixFullName", me.full_name || "");
        localStorage.setItem("phoenixDepartment", me.department?.name || "Без отдела");
      } catch (err) {
        setStatus({ loading: false, error: err.message, mode: "demo" });
        setSections(demoSections);
      } finally {
        setStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    load();
  }, [token]);

  useEffect(() => {
    if (!token) {
      setAccessRequests([]);
      return;
    }

    const loadAccessRequests = async () => {
      try {
        const response = await apiFetchAccessRequests(token);
        setAccessRequests(Array.isArray(response) ? response : response.results || []);
      } catch {
        setAccessRequests([]);
      }
    };

    loadAccessRequests();
  }, [token]);

  useEffect(() => {
    if (!token || !canManage) return;

    const loadUsers = async () => {
      try {
        setAdminStatus({ loading: true, error: "", success: "" });
        const [users, departments, services, credentials, shares] = await Promise.all([
          apiFetchUsers(token),
          apiFetchDepartments(token),
          apiFetchServices(token),
          apiFetchCredentials(token),
          apiFetchDepartmentShares(token)
        ]);
        setAdminUsers(Array.isArray(users) ? users : users.results || []);
        setAdminDepartments(Array.isArray(departments) ? departments : departments.results || []);
        setAdminServices(Array.isArray(services) ? services : services.results || []);
        setAdminCredentials(Array.isArray(credentials) ? credentials : credentials.results || []);
        setAdminShares(Array.isArray(shares) ? shares : shares.results || []);
        setAdminStatus({ loading: false, error: "", success: "" });
      } catch (err) {
        setAdminStatus({ loading: false, error: err.message, success: "" });
      }
    };

    loadUsers();
  }, [token, canManage]);

  useEffect(() => {
    setCredentialPage(1);
  }, [filters.credentialService]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const serviceFilterValue = serviceFilter;

    const sectionScoped = sections.filter(
      (section) => serviceFilterValue === "all" || String(section.id) === serviceFilterValue
    );

    if (!query) {
      return sectionScoped;
    }

    return sectionScoped
      .map((section) => ({
        ...section,
        services: section.services.filter((service) => {
          const byQuery =
            !query ||
            [
              section.name,
              service.name,
              service.url,
              service.login,
              service.owner_login,
              service.owner_name,
              service.owner_department,
              service.notes
            ]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(query));
          return byQuery;
        })
      }))
      .filter((section) => section.services.length > 0);
  }, [sections, search, serviceFilter]);

  const serviceOptions = useMemo(
    () =>
      sections.map((section) => ({
        id: String(section.id),
        name: section.name
      })),
    [sections]
  );

  useEffect(() => {
    if (serviceFilter !== "all" && !serviceOptions.some((option) => option.id === serviceFilter)) {
      setServiceFilter("all");
    }
  }, [serviceFilter, serviceOptions]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", mode: "live" });

    try {
      const data = await apiLogin(portalLogin, {
        code: challengeRequired ? loginCode.trim() : undefined
      });

      if (data.challenge_required) {
        setChallengeRequired(true);
        setStatus({ loading: false, error: "Введите код из письма и нажмите Войти.", mode: "live" });
        return;
      }

      applyAuthData(data);
    } catch (err) {
      setStatus({ loading: false, error: err.message, mode: "live" });
    }
  };

  const applyAuthData = (data) => {
    localStorage.setItem("phoenixToken", data.token);
    localStorage.setItem("phoenixRole", data.role);
    localStorage.setItem("phoenixIsSuperuser", data.is_superuser ? "1" : "0");
    localStorage.setItem("phoenixPortalLogin", data.portal_login || "");
    localStorage.setItem("phoenixUserId", String(data.id || 0));
    localStorage.setItem("phoenixDepartmentId", String(data.department?.id || 0));
    localStorage.setItem("phoenixFullName", data.full_name || "");
    localStorage.setItem("phoenixDepartment", data.department?.name || "Без отдела");
    setToken(data.token);
    setRole(data.role);
    setIsSuperuser(Boolean(data.is_superuser));
    setViewerLogin(data.portal_login || "");
    setViewerUserId(Number(data.id || 0));
    setViewerDepartmentId(Number(data.department?.id || 0));
    setViewerFullName(data.full_name || data.portal_login || "");
    setViewerDepartment(data.department?.name || "Без отдела");
    setCurrentView(data.is_superuser || isHeadRole(data.role) ? "admin" : "vault");
    setAdminTab("department");
    setPortalLogin("");
    setLoginCode("");
    setChallengeRequired(false);
    setStatus({ loading: false, error: "", mode: "live" });
  };

  useEffect(() => {
    if (token) return;
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magic_token");
    const loginFromLink = params.get("portal_login");
    if (!magicToken || !loginFromLink) return;

    const runMagicLogin = async () => {
      setStatus({ loading: true, error: "", mode: "live" });
      try {
        const data = await apiLogin(loginFromLink, { magicToken });
        applyAuthData(data);
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, "", cleanUrl);
      } catch (err) {
        setStatus({ loading: false, error: err.message || "Ошибка входа по ссылке", mode: "live" });
      }
    };

    runMagicLogin();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("phoenixToken");
    localStorage.removeItem("phoenixRole");
    localStorage.removeItem("phoenixIsSuperuser");
    localStorage.removeItem("phoenixPortalLogin");
    localStorage.removeItem("phoenixUserId");
    localStorage.removeItem("phoenixDepartmentId");
    localStorage.removeItem("phoenixFullName");
    localStorage.removeItem("phoenixDepartment");
    setToken("");
    setRole("employee");
    setIsSuperuser(false);
    setViewerLogin("");
    setViewerUserId(0);
    setViewerDepartmentId(0);
    setViewerFullName("");
    setViewerDepartment("Без отдела");
    setRequestServices([]);
    setAccessRequests([]);
    setReviewComments({});
    setAccessRequestForm({ service_id: "", justification: "" });
    setAccessRequestStatus({ loading: false, error: "", success: "" });
    setOwnRequestFilters({ status: "all", service: "all", query: "" });
    setReviewRequestFilters({ status: "all", service: "all", query: "" });
    setServiceFilter("all");
    setCurrentView("vault");
    setAdminTab("department");
    setLoginCode("");
    setChallengeRequired(false);
  };

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(requestTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopied(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
  };

  const handleCopyCredentialValue = async (value, label) => {
    try {
      if (!value) {
        throw new Error("empty");
      }
      await navigator.clipboard.writeText(String(value));
      showToast(`${label} скопирован`);
    } catch {
      showToast("Не удалось скопировать", "error");
    }
  };

  const handleDownloadCredentialSecret = async (credentialId) => {
    try {
      await apiDownloadCredentialSecret(token, credentialId);
      showToast("SSH ключ скачан");
    } catch (err) {
      showToast(err.message || "Не удалось скачать SSH ключ", "error");
    }
  };

  const handleAdminChange = (field) => (event) => {
    setAdminForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleGenerateLogin = () => {
    const seed = adminForm.email || adminForm.full_name || "user";
    const base = toLatin(seed) || "user";
    const existing = new Set(adminUsers.map((user) => user.portal_login));
    let candidate = base;
    let counter = 1;
    while (existing.has(candidate)) {
      candidate = `${base}.${counter}`;
      counter += 1;
    }
    setAdminForm((prev) => ({ ...prev, portal_login: candidate }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setAdminStatus({ loading: true, error: "", success: "" });
    try {
      if (isSuperuser && !adminForm.department_id) {
        throw new Error("Выберите отдел.");
      }
      const payload = {
        portal_login: adminForm.portal_login.trim(),
        full_name: adminForm.full_name.trim(),
        email: adminForm.email.trim(),
        role: isSuperuser ? adminForm.role : "employee",
        department_id: isSuperuser ? Number(adminForm.department_id) : undefined,
        is_active: true
      };
      const created = await apiCreateUser(token, payload);
      setAdminUsers((prev) => [created, ...prev]);
      setAdminForm({
        portal_login: "",
        full_name: "",
        email: "",
        role: "employee",
        department_id: ""
      });
      setAdminStatus({ loading: false, error: "", success: "Пользователь создан" });
    } catch (err) {
      setAdminStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleEditUser = async (user) => {
    const nextFullName = window.prompt("ФИО", user.full_name || "");
    if (nextFullName === null) return;
    const nextEmail = window.prompt("Почта", user.email || "");
    if (nextEmail === null) return;

    setAdminStatus({ loading: true, error: "", success: "" });
    try {
      const updated = await apiUpdateUser(token, user.id, {
        full_name: String(nextFullName).trim(),
        email: String(nextEmail).trim()
      });
      setAdminUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
      setAdminStatus({ loading: false, error: "", success: "Пользователь обновлен" });
    } catch (err) {
      setAdminStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDeactivateUser = async (user) => {
    const isActivating = !user.is_active;
    if (
      !window.confirm(
        `${isActivating ? "Активировать" : "Деактивировать"} пользователя ${user.portal_login}?`
      )
    ) {
      return;
    }
    setAdminStatus({ loading: true, error: "", success: "" });
    try {
      if (isActivating) {
        const updated = await apiUpdateUser(token, user.id, { is_active: true });
        setAdminUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
        setAdminStatus({ loading: false, error: "", success: "Пользователь активирован" });
      } else {
        await apiDeleteUser(token, user.id);
        setAdminUsers((prev) =>
          prev.map((item) => (item.id === user.id ? { ...item, is_active: false } : item))
        );
        setAdminStatus({ loading: false, error: "", success: "Пользователь деактивирован" });
      }
    } catch (err) {
      setAdminStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleResetUserAccess = async (user) => {
    if (!window.confirm(`Сбросить все активные доступы для ${user.portal_login}?`)) {
      return;
    }
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      const targets = adminCredentials.filter(
        (credential) => credential.user?.id === user.id && credential.is_active
      );
      if (targets.length === 0) {
        setCredentialStatus({ loading: false, error: "", success: "У пользователя нет активных доступов" });
        return;
      }
      for (const credential of targets) {
        await apiUpdateCredential(token, credential.id, { is_active: false });
      }
      await refreshAdminCredentials();
      setCredentialStatus({ loading: false, error: "", success: "Доступы пользователя сброшены" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleCredentialChange = (field) => (event) => {
    const value = event.target.value;
    setCredentialForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "secret_type") {
        if (value !== "ssh_key") {
          next.secret_filename = "";
          next.ssh_host = "";
          next.ssh_port = 22;
          next.ssh_algorithm = "";
          next.ssh_public_key = "";
          next.ssh_fingerprint = "";
          next.secret_file = null;
        }
        if (value === "ssh_key") {
          next.login = "";
          next.ssh_algorithm = next.ssh_algorithm || "ed25519";
        } else if (value === "api_token") {
          next.login = "";
          next.secret_filename = "";
        }
      }
      return next;
    });
  };

  const handleCredentialFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setCredentialForm((prev) => ({
      ...prev,
      secret_file: file,
      secret_filename: file ? file.name : prev.secret_filename
    }));
  };

  const handleShareChange = (field) => (event) => {
    setShareForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleAccessRequestChange = (field) => (event) => {
    setAccessRequestForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const refreshAdminCredentials = async () => {
    const refreshed = await apiFetchCredentials(token);
    setAdminCredentials(Array.isArray(refreshed) ? refreshed : refreshed.results || []);
  };

  const refreshAccessRequests = async () => {
    const response = await apiFetchAccessRequests(token);
    setAccessRequests(Array.isArray(response) ? response : response.results || []);
  };

  const handleCreateAccessRequest = async (event) => {
    event.preventDefault();
    setAccessRequestStatus({ loading: true, error: "", success: "" });
    try {
      if (!accessRequestForm.service_id) {
        throw new Error("Выберите сервис для запроса.");
      }
      const payload = {
        service_id: Number(accessRequestForm.service_id),
        justification: accessRequestForm.justification.trim()
      };
      await apiCreateAccessRequest(token, payload);
      await refreshAccessRequests();
      setAccessRequestForm({ service_id: "", justification: "" });
      setAccessRequestStatus({
        loading: false,
        error: "",
        success: "Запрос отправлен руководителю."
      });
    } catch (err) {
      setAccessRequestStatus({
        loading: false,
        error: err.message || "Не удалось отправить запрос.",
        success: ""
      });
    }
  };

  const handleCancelAccessRequest = async (requestId) => {
    setAccessRequestStatus({ loading: true, error: "", success: "" });
    try {
      await apiCancelAccessRequest(token, requestId);
      await refreshAccessRequests();
      setAccessRequestStatus({ loading: false, error: "", success: "Запрос отменен." });
    } catch (err) {
      setAccessRequestStatus({
        loading: false,
        error: err.message || "Не удалось отменить запрос.",
        success: ""
      });
    }
  };

  const handleReviewCommentChange = (requestId) => (event) => {
    setReviewComments((prev) => ({ ...prev, [requestId]: event.target.value }));
  };

  const handleOwnRequestFilterChange = (field) => (event) => {
    setOwnRequestFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleReviewRequestFilterChange = (field) => (event) => {
    setReviewRequestFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleApproveWithComment = async (requestId) => {
    setAccessRequestStatus({ loading: true, error: "", success: "" });
    try {
      await apiApproveAccessRequest(token, requestId, {
        review_comment: String(reviewComments[requestId] || "").trim()
      });
      await refreshAccessRequests();
      setReviewComments((prev) => ({ ...prev, [requestId]: "" }));
      setAccessRequestStatus({ loading: false, error: "", success: "Запрос одобрен." });
    } catch (err) {
      setAccessRequestStatus({
        loading: false,
        error: err.message || "Не удалось одобрить запрос.",
        success: ""
      });
    }
  };

  const handleRejectWithComment = async (requestId) => {
    setAccessRequestStatus({ loading: true, error: "", success: "" });
    try {
      await apiRejectAccessRequest(token, requestId, {
        review_comment: String(reviewComments[requestId] || "").trim()
      });
      await refreshAccessRequests();
      setReviewComments((prev) => ({ ...prev, [requestId]: "" }));
      setAccessRequestStatus({ loading: false, error: "", success: "Запрос отклонен." });
    } catch (err) {
      setAccessRequestStatus({
        loading: false,
        error: err.message || "Не удалось отклонить запрос.",
        success: ""
      });
    }
  };

  const handleCreateShare = async (event) => {
    event.preventDefault();
    setShareStatus({ loading: true, error: "", success: "" });
    try {
      if (!shareForm.grantee_id || !shareForm.expires_at) {
        throw new Error("Укажите руководителя и срок действия.");
      }
      const payload = {
        grantee_id: Number(shareForm.grantee_id),
        expires_at: new Date(shareForm.expires_at).toISOString()
      };
      if (isSuperuser) {
        if (!shareForm.department_id) {
          throw new Error("Выберите отдел.");
        }
        payload.department_id = Number(shareForm.department_id);
      }
      await apiCreateDepartmentShare(token, payload);
      const refreshed = await apiFetchDepartmentShares(token);
      setAdminShares(Array.isArray(refreshed) ? refreshed : refreshed.results || []);
      setShareForm({ grantee_id: "", expires_at: "", department_id: "" });
      setShareStatus({
        loading: false,
        error: "",
        success: "Доступ только для просмотра выдан."
      });
    } catch (err) {
      setShareStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDeleteShare = async (share) => {
    if (!window.confirm("Отозвать доступ к отделу?")) {
      return;
    }
    setShareStatus({ loading: true, error: "", success: "" });
    try {
      await apiDeleteDepartmentShare(token, share.id);
      setAdminShares((prev) => prev.filter((item) => item.id !== share.id));
      setShareStatus({ loading: false, error: "", success: "Доступ к отделу отозван." });
    } catch (err) {
      setShareStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleCreateCredential = async (event) => {
    event.preventDefault();
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      if (!credentialForm.user_id || !credentialForm.service_id) {
        throw new Error("Выберите сотрудника и сервис.");
      }
      if (credentialForm.secret_type === "password" && !credentialForm.login.trim()) {
        throw new Error("Логин обязателен.");
      }
      if (!credentialForm.password && !credentialForm.secret_file) {
        throw new Error("Секрет обязателен.");
      }
      const payload = {
        user: Number(credentialForm.user_id),
        service: Number(credentialForm.service_id),
        login:
          credentialForm.secret_type === "ssh_key"
            ? "ssh-key"
            : credentialForm.secret_type === "api_token"
              ? "api-token"
              : credentialForm.login.trim(),
        secret_type: credentialForm.secret_type || "password",
        secret_filename: credentialForm.secret_filename || "",
        ssh_host: credentialForm.ssh_host.trim(),
        ssh_port: Number(credentialForm.ssh_port || 22),
        ssh_algorithm: credentialForm.ssh_algorithm || "",
        ssh_public_key: credentialForm.ssh_public_key.trim(),
        ssh_fingerprint: credentialForm.ssh_fingerprint.trim(),
        password: credentialForm.password,
        notes: credentialForm.notes.trim(),
        is_active: true
      };
      if (credentialForm.secret_file) {
        payload.secret_file = credentialForm.secret_file;
      }
      await apiCreateCredential(token, payload);
      await refreshAdminCredentials();
      setCredentialForm({
        user_id: "",
        service_id: "",
        login: "",
        secret_type: "password",
        secret_filename: "",
        ssh_host: "",
        ssh_port: 22,
        ssh_algorithm: "",
        ssh_public_key: "",
        ssh_fingerprint: "",
        secret_file: null,
        password: "",
        notes: ""
      });
      setCredentialStatus({ loading: false, error: "", success: "Доступ сохранен" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDeleteCredential = async (credential) => {
    if (!window.confirm("Удалить учетные данные?")) {
      return;
    }
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      await apiDeleteCredential(token, credential.id);
      setAdminCredentials((prev) => prev.filter((item) => item.id !== credential.id));
      setCredentialStatus({ loading: false, error: "", success: "Доступ удален" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleToggleCredential = async (credential) => {
      setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      await apiUpdateCredential(token, credential.id, {
        is_active: !credential.is_active
      });
      await refreshAdminCredentials();
      setCredentialStatus({ loading: false, error: "", success: "Доступ обновлен" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleStartEditCredential = (credential) => {
    setEditCredentialId(credential.id);
    setEditCredentialForm({
      login: credential.login || "",
      secret_type: credential.secret_type || "password",
      secret_filename: credential.secret_filename || "",
      ssh_host: credential.ssh_host || "",
      ssh_port: credential.ssh_port || 22,
      ssh_algorithm: credential.ssh_algorithm || (credential.secret_type === "ssh_key" ? "ed25519" : ""),
      ssh_public_key: credential.ssh_public_key || "",
      ssh_fingerprint: credential.ssh_fingerprint || "",
      password: credential.password || "",
      notes: credential.notes || ""
    });
  };

  const handleEditCredentialChange = (field) => (event) => {
    const value = event.target.value;
    setEditCredentialForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "secret_type") {
        if (value !== "ssh_key") {
          next.secret_filename = "";
          next.ssh_host = "";
          next.ssh_port = 22;
          next.ssh_algorithm = "";
          next.ssh_public_key = "";
          next.ssh_fingerprint = "";
        }
        if (value === "ssh_key") {
          next.login = "";
          next.ssh_algorithm = next.ssh_algorithm || "ed25519";
        } else if (value === "api_token") {
          next.login = "";
          next.secret_filename = "";
        }
      }
      return next;
    });
  };

  const handleCancelEditCredential = () => {
    setEditCredentialId(null);
    setEditCredentialForm({
      login: "",
      secret_type: "password",
      secret_filename: "",
      ssh_host: "",
      ssh_port: 22,
      ssh_algorithm: "",
      ssh_public_key: "",
      ssh_fingerprint: "",
      password: "",
      notes: ""
    });
  };

  const handleSaveCredential = async (credential) => {
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      if (!editCredentialForm.password) {
        throw new Error("Секрет обязателен.");
      }
      if (editCredentialForm.secret_type === "password" && !editCredentialForm.login.trim()) {
        throw new Error("Логин обязателен.");
      }
      await apiUpdateCredential(token, credential.id, {
        login:
          editCredentialForm.secret_type === "ssh_key"
            ? "ssh-key"
            : editCredentialForm.secret_type === "api_token"
              ? "api-token"
              : editCredentialForm.login.trim(),
        secret_type: editCredentialForm.secret_type || "password",
        secret_filename: editCredentialForm.secret_filename || "",
        ssh_host: editCredentialForm.ssh_host.trim(),
        ssh_port: Number(editCredentialForm.ssh_port || 22),
        ssh_algorithm: editCredentialForm.ssh_algorithm || "",
        ssh_public_key: editCredentialForm.ssh_public_key.trim(),
        ssh_fingerprint: editCredentialForm.ssh_fingerprint.trim(),
        password: editCredentialForm.password,
        notes: editCredentialForm.notes.trim()
      });
      await refreshAdminCredentials();
      setEditCredentialId(null);
      setEditCredentialForm({
        login: "",
        secret_type: "password",
        secret_filename: "",
        ssh_host: "",
        ssh_port: 22,
        ssh_algorithm: "",
        ssh_public_key: "",
        ssh_fingerprint: "",
        password: "",
        notes: ""
      });
      setCredentialStatus({ loading: false, error: "", success: "Доступ обновлен" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const requestableServices = useMemo(() => {
    const source = canManage && adminServices.length > 0 ? adminServices : requestServices;
    const unique = new Map();
    source.forEach((service) => {
      if (!service?.id) return;
      unique.set(service.id, service);
    });
    return Array.from(unique.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ru")
    );
  }, [canManage, adminServices, requestServices]);

  const ownAccessRequests = useMemo(
    () =>
      accessRequests.filter(
        (item) => item.requester?.portal_login === viewerLogin
      ),
    [accessRequests, viewerLogin]
  );

  const reviewableAccessRequests = useMemo(() => {
    if (!canManage) return [];
    if (isSuperuser) return accessRequests;
    return accessRequests.filter(
      (item) => Number(item.requester?.department?.id || 0) === viewerDepartmentId
    );
  }, [accessRequests, canManage, isSuperuser, viewerDepartmentId]);

  const ownRequestServiceOptions = useMemo(() => {
    const unique = new Map();
    ownAccessRequests.forEach((item) => {
      if (!item?.service?.id) return;
      unique.set(item.service.id, item.service.name || `Сервис ${item.service.id}`);
    });
    return Array.from(unique.entries())
      .map(([id, name]) => ({ id: String(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [ownAccessRequests]);

  const reviewRequestServiceOptions = useMemo(() => {
    const unique = new Map();
    reviewableAccessRequests.forEach((item) => {
      if (!item?.service?.id) return;
      unique.set(item.service.id, item.service.name || `Сервис ${item.service.id}`);
    });
    return Array.from(unique.entries())
      .map(([id, name]) => ({ id: String(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [reviewableAccessRequests]);

  useEffect(() => {
    if (
      ownRequestFilters.service !== "all" &&
      !ownRequestServiceOptions.some((service) => service.id === ownRequestFilters.service)
    ) {
      setOwnRequestFilters((prev) => ({ ...prev, service: "all" }));
    }
  }, [ownRequestFilters.service, ownRequestServiceOptions]);

  useEffect(() => {
    if (
      reviewRequestFilters.service !== "all" &&
      !reviewRequestServiceOptions.some((service) => service.id === reviewRequestFilters.service)
    ) {
      setReviewRequestFilters((prev) => ({ ...prev, service: "all" }));
    }
  }, [reviewRequestFilters.service, reviewRequestServiceOptions]);

  const filterAccessRequests = (items, filterState) => {
    const query = String(filterState.query || "").trim().toLowerCase();
    return items.filter((item) => {
      const byStatus = filterState.status === "all" || item.status === filterState.status;
      const byService =
        filterState.service === "all" || String(item.service?.id || "") === filterState.service;
      const byQuery =
        !query ||
        [
          item.requester?.portal_login,
          item.reviewer?.portal_login,
          item.service?.name,
          item.justification,
          item.review_comment,
          ACCESS_REQUEST_STATUS_LABEL[item.status] || item.status
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query));
      return byStatus && byService && byQuery;
    });
  };

  const ownFilteredAccessRequests = useMemo(
    () => filterAccessRequests(ownAccessRequests, ownRequestFilters),
    [ownAccessRequests, ownRequestFilters]
  );

  const filteredReviewableAccessRequests = useMemo(
    () => filterAccessRequests(reviewableAccessRequests, reviewRequestFilters),
    [reviewableAccessRequests, reviewRequestFilters]
  );

  const exportAccessRequestsCsv = (items, prefix) => {
    try {
      const headers = [
        "ID",
        "Статус",
        "Сервис",
        "Запросил",
        "Ревьюер",
        "Обоснование",
        "Комментарий ревьюера",
        "Запрошено",
        "Рассмотрено"
      ];
      const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
      const rows = items.map((item) => [
        item.id,
        ACCESS_REQUEST_STATUS_LABEL[item.status] || item.status,
        item.service?.name || "",
        item.requester?.portal_login || "",
        item.reviewer?.portal_login || "",
        item.justification || "",
        item.review_comment || "",
        item.requested_at ? new Date(item.requested_at).toLocaleString("ru-RU") : "",
        item.reviewed_at ? new Date(item.reviewed_at).toLocaleString("ru-RU") : ""
      ]);
      const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
      const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
      const filename = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast("CSV экспорт готов");
    } catch {
      showToast("Не удалось выгрузить CSV", "error");
    }
  };

  const headCandidates = adminUsers.filter(
    (user) => isHeadRole(user.role) && !user.is_superuser && user.portal_login !== viewerLogin
  );
  const writableUsers = adminUsers.filter((user) => {
    if (user.is_superuser) {
      return false;
    }
    if (isHeadRole(user.role)) {
      return false;
    }
    if (isSuperuser) {
      return true;
    }
    return Number(user.department?.id || 0) === viewerDepartmentId;
  });
  const departmentUsers = writableUsers.filter((user) =>
    isSuperuser ? true : Number(user.department?.id || 0) === viewerDepartmentId
  );
  const canWriteForUser = (user) => {
    if (isSuperuser) {
      return true;
    }
    return Number(user?.department?.id || 0) === viewerDepartmentId;
  };
  const selfCredentials = adminCredentials.filter(
    (credential) => Number(credential.user?.id || 0) === viewerUserId
  );
  const canRevokeShare = (share) =>
    isSuperuser || Number(share.department?.id || 0) === viewerDepartmentId;
  const activeShares = adminShares.filter(
    (share) =>
      share.is_active &&
      (!share.expires_at || new Date(share.expires_at).getTime() > Date.now())
  );

  return (
    <div className={`page ${isAuthenticated ? "page-admin" : ""}`}>
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="orb orb-three" />
      </div>

      <AppHeader
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      {!isAuthenticated ? (
        <AuthPage
          status={status}
          portalLogin={portalLogin}
          onPortalLoginChange={(value) => {
            setPortalLogin(value);
            setChallengeRequired(false);
            setLoginCode("");
          }}
          challengeRequired={challengeRequired}
          loginCode={loginCode}
          onLoginCodeChange={setLoginCode}
          onLogin={handleLogin}
          requestEmail={requestEmail}
          requestSubject={requestSubject}
          requestTemplate={requestTemplate}
          copied={copied}
          onCopyTemplate={handleCopyTemplate}
        />
      ) : null}

      {isAuthenticated && currentView !== "admin" && (
        <section className="workspace-shell">
          <AppSidebar
            viewerFullName={viewerFullName}
            viewerDepartment={viewerDepartment}
            roleLabel={roleLabel}
            currentView={currentView}
            canOpenServicesTab={canOpenServicesTab}
            showVaultTab={showVaultTab}
            onToggleView={setCurrentView}
          />

          <div className="workspace-main">
            {currentView === "vault" && showVaultTab ? (
              <VaultPage
                serviceGroupsCount={sections.length}
                search={search}
                onSearchChange={setSearch}
                serviceFilter={serviceFilter}
                onServiceFilterChange={setServiceFilter}
                serviceOptions={serviceOptions}
                filteredSections={filteredSections}
                onCopyField={handleCopyCredentialValue}
                onDownloadCredentialSecret={handleDownloadCredentialSecret}
              />
            ) : currentView === "services" && canOpenServicesTab ? (
              <ServicesPage
                requestableServices={requestableServices}
                accessRequestForm={accessRequestForm}
                onAccessRequestChange={handleAccessRequestChange}
                onCreateAccessRequest={handleCreateAccessRequest}
                accessRequestStatus={accessRequestStatus}
                ownAccessRequests={ownFilteredAccessRequests}
                ownAccessRequestsTotal={ownAccessRequests.length}
                ownRequestFilters={ownRequestFilters}
                ownRequestServiceOptions={ownRequestServiceOptions}
                onOwnRequestFilterChange={handleOwnRequestFilterChange}
                onExportOwnRequestsCsv={() =>
                  exportAccessRequestsCsv(ownFilteredAccessRequests, "my_access_requests")
                }
                onCancelAccessRequest={handleCancelAccessRequest}
              />
            ) : null}
          </div>
        </section>
      )}

      {isAuthenticated && canManage && currentView === "admin" && (
        <AdminPanel
          isSuperuser={isSuperuser}
          adminTab={adminTab}
          onAdminTabChange={setAdminTab}
          adminForm={adminForm}
          onAdminChange={handleAdminChange}
          onGenerateLogin={handleGenerateLogin}
          adminDepartments={adminDepartments}
          adminStatus={adminStatus}
          onCreateUser={handleCreateUser}
          onEditUser={handleEditUser}
          onDeactivateUser={handleDeactivateUser}
          onResetUserAccess={handleResetUserAccess}
          shareForm={shareForm}
          onShareChange={handleShareChange}
          headCandidates={headCandidates}
          shareStatus={shareStatus}
          onCreateShare={handleCreateShare}
          activeShares={activeShares}
          canRevokeShare={canRevokeShare}
          onDeleteShare={handleDeleteShare}
          writableUsers={writableUsers}
          adminServices={adminServices}
          filters={filters}
          onFilterChange={handleFilterChange}
          canWriteForUser={canWriteForUser}
          isDepartmentHead={isDepartmentHead}
          viewerUserId={viewerUserId}
          viewerFullName={viewerFullName}
          viewerDepartment={viewerDepartment}
          roleLabel={roleLabel}
          credentialForm={credentialForm}
          onCredentialChange={handleCredentialChange}
          onCredentialFileChange={handleCredentialFileChange}
          credentialStatus={credentialStatus}
          onCreateCredential={handleCreateCredential}
          editCredentialId={editCredentialId}
          editCredentialForm={editCredentialForm}
          onEditCredentialChange={handleEditCredentialChange}
          onSaveCredential={handleSaveCredential}
          onCancelEditCredential={handleCancelEditCredential}
          onStartEditCredential={handleStartEditCredential}
          onToggleCredential={handleToggleCredential}
          onDeleteCredential={handleDeleteCredential}
          onDownloadCredentialSecret={handleDownloadCredentialSecret}
          credentialPage={credentialPage}
          setCredentialPage={setCredentialPage}
          adminUsers={departmentUsers}
          accessRequests={filteredReviewableAccessRequests}
          accessRequestsTotal={reviewableAccessRequests.length}
          accessRequestStatus={accessRequestStatus}
          onApproveAccessRequest={handleApproveWithComment}
          onRejectAccessRequest={handleRejectWithComment}
          reviewComments={reviewComments}
          onReviewCommentChange={handleReviewCommentChange}
          reviewRequestFilters={reviewRequestFilters}
          reviewRequestServiceOptions={reviewRequestServiceOptions}
          onReviewRequestFilterChange={handleReviewRequestFilterChange}
          onExportAccessRequestsCsv={() =>
            exportAccessRequestsCsv(filteredReviewableAccessRequests, "department_access_requests")
          }
          adminCredentials={adminCredentials}
          selfCredentials={selfCredentials}
        />
      )}

      {toast.visible && (
        <div
          className={`app-toast ${toast.type === "error" ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

    </div>
  );
}
