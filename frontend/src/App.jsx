import { useEffect, useMemo, useState } from "react";
import {
  apiCreateAccess,
  apiCreateCredential,
  apiCreateDepartmentShare,
  apiCreateUser,
  apiDeleteAccess,
  apiDeleteCredential,
  apiDeleteDepartmentShare,
  apiFetchAccesses,
  apiFetchCredentials,
  apiFetchDepartmentShares,
  apiFetchDepartments,
  apiFetchMe,
  apiFetchServices,
  apiFetchUsers,
  apiLogin,
  apiUpdateAccess,
  apiUpdateCredential
} from "./api";
import AdminPanel from "./components/AdminPanel";
import AppHeader from "./components/AppHeader";
import AuthPage from "./components/AuthPage";
import VaultPage from "./components/VaultPage";
import { demoSections } from "./data/demo";

const accentClass = {
  sunset: "accent-sunset",
  sky: "accent-sky",
  mint: "accent-mint"
};

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
const PAGE_SIZE = 6;

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

export default function App() {
  const [portalLogin, setPortalLogin] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("phoenixToken") || "");
  const [role, setRole] = useState(localStorage.getItem("phoenixRole") || "employee");
  const [isSuperuser, setIsSuperuser] = useState(
    () => localStorage.getItem("phoenixIsSuperuser") === "1"
  );
  const [viewerLogin, setViewerLogin] = useState(
    () => localStorage.getItem("phoenixPortalLogin") || ""
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
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [revealed, setRevealed] = useState({});
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
  const [status, setStatus] = useState({ loading: false, error: "", mode: "demo" });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDepartments, setAdminDepartments] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [adminAccesses, setAdminAccesses] = useState([]);
  const [adminCredentials, setAdminCredentials] = useState([]);
  const [adminShares, setAdminShares] = useState([]);
  const [adminStatus, setAdminStatus] = useState({ loading: false, error: "", success: "" });
  const [accessStatus, setAccessStatus] = useState({ loading: false, error: "", success: "" });
  const [credentialStatus, setCredentialStatus] = useState({
    loading: false,
    error: "",
    success: ""
  });
  const [shareStatus, setShareStatus] = useState({ loading: false, error: "", success: "" });
  const [filters, setFilters] = useState({
    accessUser: "all",
    accessService: "all",
    credentialUser: "all",
    credentialService: "all"
  });
  const [accessPage, setAccessPage] = useState(1);
  const [credentialPage, setCredentialPage] = useState(1);
  const [editCredentialId, setEditCredentialId] = useState(null);
  const [editCredentialForm, setEditCredentialForm] = useState({
    login: "",
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
  const [accessForm, setAccessForm] = useState({ user_id: "", service_id: "" });
  const [credentialForm, setCredentialForm] = useState({
    user_id: "",
    service_id: "",
    login: "",
    password: "",
    notes: ""
  });
  const [shareForm, setShareForm] = useState({
    grantee_id: "",
    expires_at: "",
    department_id: ""
  });
  const [currentView, setCurrentView] = useState("vault");
  const [adminTab, setAdminTab] = useState("users");

  const isAuthenticated = Boolean(token);
  const isDepartmentHead = isHeadRole(role);
  const canManage = isSuperuser || isDepartmentHead;
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
        const [credentials, me] = await Promise.all([apiFetchCredentials(token), apiFetchMe(token)]);
        setSections(groupCredentialsByService(credentials));
        setRole(me.role);
        setIsSuperuser(Boolean(me.is_superuser));
        setViewerLogin(me.portal_login || "");
        setViewerDepartmentId(Number(me.department?.id || 0));
        setViewerFullName(me.full_name || me.portal_login || "");
        setViewerDepartment(me.department?.name || "Без отдела");
        localStorage.setItem("phoenixRole", me.role || "employee");
        localStorage.setItem("phoenixIsSuperuser", me.is_superuser ? "1" : "0");
        localStorage.setItem("phoenixPortalLogin", me.portal_login || "");
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
    if (!token || !canManage) return;

    const loadUsers = async () => {
      try {
        setAdminStatus({ loading: true, error: "", success: "" });
        const [users, departments, services, accesses, credentials, shares] = await Promise.all([
          apiFetchUsers(token),
          apiFetchDepartments(token),
          apiFetchServices(token),
          apiFetchAccesses(token),
          apiFetchCredentials(token),
          apiFetchDepartmentShares(token)
        ]);
        setAdminUsers(Array.isArray(users) ? users : users.results || []);
        setAdminDepartments(Array.isArray(departments) ? departments : departments.results || []);
        setAdminServices(Array.isArray(services) ? services : services.results || []);
        setAdminAccesses(Array.isArray(accesses) ? accesses : accesses.results || []);
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
    setAccessPage(1);
  }, [filters.accessUser, filters.accessService]);

  useEffect(() => {
    setCredentialPage(1);
  }, [filters.credentialUser, filters.credentialService]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const serviceFilterValue = serviceFilter;
    const departmentFilterValue = departmentFilter;
    const ownerFilterValue = ownerFilter;

    const sectionScoped = sections.filter(
      (section) => serviceFilterValue === "all" || String(section.id) === serviceFilterValue
    );

    if (!query && departmentFilterValue === "all" && ownerFilterValue === "all") {
      return sectionScoped;
    }

    return sectionScoped
      .map((section) => ({
        ...section,
        services: section.services.filter((service) => {
          const byDepartment =
            departmentFilterValue === "all" ||
            (service.owner_department || "Без отдела") === departmentFilterValue;
          const byOwner = ownerFilterValue === "all" || service.owner_login === ownerFilterValue;
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
          return byDepartment && byOwner && byQuery;
        })
      }))
      .filter((section) => section.services.length > 0);
  }, [sections, search, serviceFilter, departmentFilter, ownerFilter]);

  const serviceOptions = useMemo(
    () =>
      sections.map((section) => ({
        id: String(section.id),
        name: section.name
      })),
    [sections]
  );

  const departmentOptions = useMemo(() => {
    const unique = new Set();
    sections.forEach((section) => {
      section.services.forEach((service) => {
        unique.add(service.owner_department || "Без отдела");
      });
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ru"));
  }, [sections]);

  const ownerOptions = useMemo(() => {
    const unique = new Map();
    sections.forEach((section) => {
      section.services.forEach((service) => {
        const login = service.owner_login;
        if (!login) return;
        if (!unique.has(login)) {
          unique.set(login, service.owner_name ? `${login} (${service.owner_name})` : login);
        }
      });
    });
    return Array.from(unique.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [sections]);

  useEffect(() => {
    if (serviceFilter !== "all" && !serviceOptions.some((option) => option.id === serviceFilter)) {
      setServiceFilter("all");
    }
  }, [serviceFilter, serviceOptions]);

  useEffect(() => {
    if (departmentFilter !== "all" && !departmentOptions.includes(departmentFilter)) {
      setDepartmentFilter("all");
    }
  }, [departmentFilter, departmentOptions]);

  useEffect(() => {
    if (ownerFilter !== "all" && !ownerOptions.some((option) => option.value === ownerFilter)) {
      setOwnerFilter("all");
    }
  }, [ownerFilter, ownerOptions]);

  useEffect(() => {
    if (!token) {
      setServiceFilter("all");
      setDepartmentFilter("all");
      setOwnerFilter("all");
    }
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", mode: "live" });

    try {
      const data = await apiLogin(portalLogin);
      localStorage.setItem("phoenixToken", data.token);
      localStorage.setItem("phoenixRole", data.role);
      localStorage.setItem("phoenixIsSuperuser", data.is_superuser ? "1" : "0");
      localStorage.setItem("phoenixPortalLogin", data.portal_login || "");
      localStorage.setItem("phoenixDepartmentId", String(data.department?.id || 0));
      localStorage.setItem("phoenixFullName", data.full_name || "");
      localStorage.setItem("phoenixDepartment", data.department?.name || "Без отдела");
      setToken(data.token);
      setRole(data.role);
      setIsSuperuser(Boolean(data.is_superuser));
      setViewerLogin(data.portal_login || "");
      setViewerDepartmentId(Number(data.department?.id || 0));
      setViewerFullName(data.full_name || data.portal_login || "");
      setViewerDepartment(data.department?.name || "Без отдела");
      setCurrentView("vault");
      setAdminTab("users");
      setPortalLogin("");
    } catch (err) {
      setStatus({ loading: false, error: err.message, mode: "demo" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("phoenixToken");
    localStorage.removeItem("phoenixRole");
    localStorage.removeItem("phoenixIsSuperuser");
    localStorage.removeItem("phoenixPortalLogin");
    localStorage.removeItem("phoenixDepartmentId");
    localStorage.removeItem("phoenixFullName");
    localStorage.removeItem("phoenixDepartment");
    setToken("");
    setRole("employee");
    setIsSuperuser(false);
    setViewerLogin("");
    setViewerDepartmentId(0);
    setViewerFullName("");
    setViewerDepartment("Без отдела");
    setServiceFilter("all");
    setDepartmentFilter("all");
    setOwnerFilter("all");
    setCurrentView("vault");
    setAdminTab("users");
  };

  const toggleReveal = (id) => {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const handleAccessChange = (field) => (event) => {
    setAccessForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCredentialChange = (field) => (event) => {
    setCredentialForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleShareChange = (field) => (event) => {
    setShareForm((prev) => ({ ...prev, [field]: event.target.value }));
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
        success: "Read-only доступ к отделу выдан."
      });
    } catch (err) {
      setShareStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDeleteShare = async (share) => {
    setShareStatus({ loading: true, error: "", success: "" });
    try {
      await apiDeleteDepartmentShare(token, share.id);
      setAdminShares((prev) => prev.filter((item) => item.id !== share.id));
      setShareStatus({ loading: false, error: "", success: "Доступ к отделу отозван." });
    } catch (err) {
      setShareStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleCreateAccess = async (event) => {
    event.preventDefault();
    setAccessStatus({ loading: true, error: "", success: "" });
    try {
      if (!accessForm.user_id || !accessForm.service_id) {
        throw new Error("Выберите сотрудника и сервис.");
      }
      const payload = {
        user_id: Number(accessForm.user_id),
        service_id: Number(accessForm.service_id),
        is_active: true
      };
      await apiCreateAccess(token, payload);
      const refreshed = await apiFetchAccesses(token);
      setAdminAccesses(Array.isArray(refreshed) ? refreshed : refreshed.results || []);
      setAccessForm({ user_id: "", service_id: "" });
      setAccessStatus({ loading: false, error: "", success: "Доступ назначен" });
    } catch (err) {
      setAccessStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleToggleAccess = async (access) => {
    setAccessStatus({ loading: true, error: "", success: "" });
    try {
      const updated = await apiUpdateAccess(token, access.id, { is_active: !access.is_active });
      setAdminAccesses((prev) =>
        prev.map((item) => (item.id === access.id ? updated : item))
      );
      setAccessStatus({ loading: false, error: "", success: "Доступ обновлён" });
    } catch (err) {
      setAccessStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDeleteAccess = async (access) => {
    setAccessStatus({ loading: true, error: "", success: "" });
    try {
      await apiDeleteAccess(token, access.id);
      setAdminAccesses((prev) => prev.filter((item) => item.id !== access.id));
      setAccessStatus({ loading: false, error: "", success: "Доступ удалён" });
    } catch (err) {
      setAccessStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleCreateCredential = async (event) => {
    event.preventDefault();
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      if (!credentialForm.user_id || !credentialForm.service_id) {
        throw new Error("Выберите сотрудника и сервис.");
      }
      if (!credentialForm.login.trim() || !credentialForm.password) {
        throw new Error("Логин и пароль обязательны.");
      }
      const payload = {
        user: Number(credentialForm.user_id),
        service: Number(credentialForm.service_id),
        login: credentialForm.login.trim(),
        password: credentialForm.password,
        notes: credentialForm.notes.trim(),
        is_active: true
      };
      await apiCreateCredential(token, payload);
      const refreshed = await apiFetchCredentials(token);
      setAdminCredentials(Array.isArray(refreshed) ? refreshed : refreshed.results || []);
      setCredentialForm({ user_id: "", service_id: "", login: "", password: "", notes: "" });
      setCredentialStatus({ loading: false, error: "", success: "Креды сохранены" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDeleteCredential = async (credential) => {
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      await apiDeleteCredential(token, credential.id);
      setAdminCredentials((prev) => prev.filter((item) => item.id !== credential.id));
      setCredentialStatus({ loading: false, error: "", success: "Креды удалены" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleToggleCredential = async (credential) => {
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      const updated = await apiUpdateCredential(token, credential.id, {
        is_active: !credential.is_active
      });
      setAdminCredentials((prev) =>
        prev.map((item) => (item.id === credential.id ? updated : item))
      );
      setCredentialStatus({ loading: false, error: "", success: "Креды обновлены" });
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
      password: credential.password || "",
      notes: credential.notes || ""
    });
  };

  const handleEditCredentialChange = (field) => (event) => {
    setEditCredentialForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCancelEditCredential = () => {
    setEditCredentialId(null);
    setEditCredentialForm({ login: "", password: "", notes: "" });
  };

  const handleSaveCredential = async (credential) => {
    setCredentialStatus({ loading: true, error: "", success: "" });
    try {
      if (!editCredentialForm.login.trim() || !editCredentialForm.password) {
        throw new Error("Логин и пароль обязательны.");
      }
      const updated = await apiUpdateCredential(token, credential.id, {
        login: editCredentialForm.login.trim(),
        password: editCredentialForm.password,
        notes: editCredentialForm.notes.trim()
      });
      setAdminCredentials((prev) =>
        prev.map((item) => (item.id === credential.id ? updated : item))
      );
      setEditCredentialId(null);
      setEditCredentialForm({ login: "", password: "", notes: "" });
      setCredentialStatus({ loading: false, error: "", success: "Креды обновлены" });
    } catch (err) {
      setCredentialStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const totalServices = sections.reduce((sum, section) => sum + section.services.length, 0);
  const filteredAccesses = adminAccesses.filter((access) => {
    const byUser =
      filters.accessUser === "all" || String(access.user?.id) === filters.accessUser;
    const byService =
      filters.accessService === "all" || String(access.service?.id) === filters.accessService;
    return byUser && byService;
  });
  const filteredCredentials = adminCredentials.filter((credential) => {
    const byUser =
      filters.credentialUser === "all" ||
      String(credential.user?.id) === filters.credentialUser;
    const byService =
      filters.credentialService === "all" ||
      String(credential.service?.id) === filters.credentialService;
    return byUser && byService;
  });
  const accessTotalPages = Math.max(1, Math.ceil(filteredAccesses.length / PAGE_SIZE));
  const credentialTotalPages = Math.max(1, Math.ceil(filteredCredentials.length / PAGE_SIZE));
  const accessStart = (accessPage - 1) * PAGE_SIZE;
  const credentialStart = (credentialPage - 1) * PAGE_SIZE;
  const pagedAccesses = filteredAccesses.slice(accessStart, accessStart + PAGE_SIZE);
  const pagedCredentials = filteredCredentials.slice(
    credentialStart,
    credentialStart + PAGE_SIZE
  );
  const headCandidates = adminUsers.filter(
    (user) => isHeadRole(user.role) && !user.is_superuser && user.portal_login !== viewerLogin
  );
  const writableUsers = adminUsers.filter((user) => {
    if (user.is_superuser) {
      return false;
    }
    if (isSuperuser) {
      return true;
    }
    return Number(user.department?.id || 0) === viewerDepartmentId;
  });
  const canWriteForUser = (user) => {
    if (isSuperuser) {
      return true;
    }
    return Number(user?.department?.id || 0) === viewerDepartmentId;
  };
  const canRevokeShare = (share) =>
    isSuperuser || Number(share.department?.id || 0) === viewerDepartmentId;
  const activeShares = adminShares.filter(
    (share) =>
      share.is_active &&
      (!share.expires_at || new Date(share.expires_at).getTime() > Date.now())
  );

  useEffect(() => {
    if (accessPage > accessTotalPages) {
      setAccessPage(accessTotalPages);
    }
  }, [accessPage, accessTotalPages]);

  useEffect(() => {
    if (credentialPage > credentialTotalPages) {
      setCredentialPage(credentialTotalPages);
    }
  }, [credentialPage, credentialTotalPages]);

  return (
    <div className="page">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="orb orb-three" />
      </div>

      <AppHeader
        isAuthenticated={isAuthenticated}
        viewerDepartment={viewerDepartment}
        viewerFullName={viewerFullName}
        roleLabel={roleLabel}
        canManage={canManage}
        currentView={currentView}
        onToggleView={(targetView) => setCurrentView(targetView)}
        onLogout={handleLogout}
      />

      {!isAuthenticated ? (
        <AuthPage
          status={status}
          portalLogin={portalLogin}
          onPortalLoginChange={setPortalLogin}
          onLogin={handleLogin}
          requestEmail={requestEmail}
          requestSubject={requestSubject}
          requestTemplate={requestTemplate}
          copied={copied}
          onCopyTemplate={handleCopyTemplate}
        />
      ) : currentView === "vault" ? (
        <VaultPage
          totalServices={totalServices}
          serviceGroupsCount={sections.length}
          search={search}
          onSearchChange={setSearch}
          serviceFilter={serviceFilter}
          onServiceFilterChange={setServiceFilter}
          serviceOptions={serviceOptions}
          departmentOptions={departmentOptions}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          ownerOptions={ownerOptions}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          filteredSections={filteredSections}
          accentClass={accentClass}
          revealed={revealed}
          onToggleReveal={toggleReveal}
          onCopyField={handleCopyCredentialValue}
        />
      ) : (
        <section className="page-title-bar">
          <h2>Панель руководителя</h2>
          <span className="subtitle">
            Управление пользователями, доступами, кредами и read-only доступом к отделу
          </span>
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
          shareForm={shareForm}
          onShareChange={handleShareChange}
          headCandidates={headCandidates}
          shareStatus={shareStatus}
          onCreateShare={handleCreateShare}
          activeShares={activeShares}
          canRevokeShare={canRevokeShare}
          onDeleteShare={handleDeleteShare}
          accessForm={accessForm}
          onAccessChange={handleAccessChange}
          writableUsers={writableUsers}
          adminServices={adminServices}
          accessStatus={accessStatus}
          onCreateAccess={handleCreateAccess}
          filters={filters}
          onFilterChange={handleFilterChange}
          pagedAccesses={pagedAccesses}
          canWriteForUser={canWriteForUser}
          onToggleAccess={handleToggleAccess}
          onDeleteAccess={handleDeleteAccess}
          filteredAccesses={filteredAccesses}
          accessPage={accessPage}
          accessTotalPages={accessTotalPages}
          setAccessPage={setAccessPage}
          credentialForm={credentialForm}
          onCredentialChange={handleCredentialChange}
          credentialStatus={credentialStatus}
          onCreateCredential={handleCreateCredential}
          filteredCredentials={filteredCredentials}
          pagedCredentials={pagedCredentials}
          editCredentialId={editCredentialId}
          editCredentialForm={editCredentialForm}
          onEditCredentialChange={handleEditCredentialChange}
          onSaveCredential={handleSaveCredential}
          onCancelEditCredential={handleCancelEditCredential}
          onStartEditCredential={handleStartEditCredential}
          onToggleCredential={handleToggleCredential}
          onDeleteCredential={handleDeleteCredential}
          credentialPage={credentialPage}
          credentialTotalPages={credentialTotalPages}
          setCredentialPage={setCredentialPage}
          adminUsers={adminUsers}
          isHeadRole={isHeadRole}
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

      {isAuthenticated && (
        <footer className="footer">
          <div>
            <strong>Phoenix Vault</strong>
            <span>Внутренний сервис доступа Avatariya</span>
          </div>
        </footer>
      )}
    </div>
  );
}
