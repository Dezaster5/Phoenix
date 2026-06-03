import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiApproveAccessRequest,
  apiCancelAccessRequest,
  apiCreateAccessRequest,
  apiCreateCredential,
  apiCreateDepartmentShare,
  apiCreateUser,
  apiDeleteCredential,
  apiDeleteDepartmentShare,
  apiDeleteUser,
  apiDownloadCredentialSecret,
  apiFetchAccessRequests,
  apiFetchAuditLogs,
  apiFetchCredentials,
  apiFetchDepartmentShares,
  apiFetchDepartments,
  apiFetchMe,
  apiFetchPublicDepartments,
  apiFetchServices,
  apiFetchUsers,
  apiLogin,
  apiExportAuditLogsCsv,
  apiRegisterRequest,
  apiRegisterVerify,
  apiPasswordResetRequest,
  apiPasswordResetConfirm,
  apiChangePassword,
  apiRejectAccessRequest,
  apiUpdateCredential,
  apiUpdateUser
} from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { demoSections } from "../data/demo";

const ACCESS_REQUEST_STATUS_LABEL = {
  pending: "ожидает",
  approved: "одобрен",
  rejected: "отклонен",
  canceled: "отменен"
};

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
      created_at: cred.created_at,
      updated_at: cred.updated_at,
      owner_login: cred.user?.portal_login || "",
      owner_name: cred.user?.full_name || "",
      owner_department: cred.user?.department?.name || "Без отдела"
    });
  });

  return Array.from(grouped.values());
};

const createStatusState = (mode = "demo") => ({
  loading: false,
  error: "",
  mode
});

const createMessageState = () => ({
  loading: false,
  error: "",
  success: ""
});

const createOwnRequestFilters = () => ({
  status: "all",
  service: "all",
  query: ""
});

const createReviewRequestFilters = () => ({
  status: "all",
  service: "all",
  query: ""
});

const createAuditFilters = () => ({
  actor: "",
  action: "all",
  object_type: "all",
  date_from: "",
  date_to: ""
});

const createCredentialForm = () => ({
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

const createEditCredentialForm = () => ({
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

const createAdminForm = () => ({
  portal_login: "",
  full_name: "",
  email: "",
  role: "employee",
  department_id: ""
});

const createShareForm = () => ({
  grantee_id: "",
  expires_at: "",
  department_id: ""
});

const createAccessRequestForm = () => ({
  service_id: "",
  justification: ""
});

const createRegistrationForm = () => ({
  email: "",
  iin: "",
  department_id: "",
  password: "",
  password_confirm: ""
});

const createLoginForm = () => ({
  email: "",
  password: ""
});

const createResetForm = () => ({
  email: "",
  password: "",
  password_confirm: ""
});

const createPasswordChangeForm = () => ({
  current_password: "",
  password: "",
  password_confirm: ""
});

const byDateDesc = (field) => (a, b) => {
  const aTime = new Date(a?.[field] || 0).getTime() || 0;
  const bTime = new Date(b?.[field] || 0).getTime() || 0;
  return bTime - aTime;
};

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

export default function usePhoenixAppState() {
  const navigate = useNavigate();
  const {
    token,
    role,
    isSuperuser,
    viewerLogin,
    viewerUserId,
    viewerDepartmentId,
    viewerFullName,
    viewerDepartment,
    isAuthenticated,
    applyAuthPayload,
    logout
  } = useAuth();

  const [loginForm, setLoginForm] = useState(createLoginForm());
  const [authMode, setAuthMode] = useState("login");
  const [registrationStep, setRegistrationStep] = useState("form");
  const [registrationCode, setRegistrationCode] = useState("");
  const [resetStep, setResetStep] = useState("email");
  const [resetForm, setResetForm] = useState(createResetForm());
  const [resetCode, setResetCode] = useState("");
  const [resetStatus, setResetStatus] = useState(createMessageState());
  const [passwordChangeForm, setPasswordChangeForm] = useState(createPasswordChangeForm());
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordChangeStatus, setPasswordChangeStatus] = useState(createMessageState());
  const [sections, setSections] = useState(demoSections);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
  const [status, setStatus] = useState(createStatusState());
  const [publicDepartments, setPublicDepartments] = useState([]);
  const [registrationForm, setRegistrationForm] = useState(createRegistrationForm());
  const [registrationStatus, setRegistrationStatus] = useState(createMessageState());
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDepartments, setAdminDepartments] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [requestServices, setRequestServices] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [adminCredentials, setAdminCredentials] = useState([]);
  const [adminShares, setAdminShares] = useState([]);
  const [adminStatus, setAdminStatus] = useState(createMessageState());
  const [credentialStatus, setCredentialStatus] = useState(createMessageState());
  const [shareStatus, setShareStatus] = useState(createMessageState());
  const [accessRequestStatus, setAccessRequestStatus] = useState(createMessageState());
  const [ownRequestFilters, setOwnRequestFilters] = useState(createOwnRequestFilters());
  const [reviewRequestFilters, setReviewRequestFilters] = useState(createReviewRequestFilters());
  const [auditFilters, setAuditFilters] = useState(createAuditFilters());
  const [reviewComments, setReviewComments] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStatus, setAuditStatus] = useState(createMessageState());
  const [filters, setFilters] = useState({ credentialService: "all" });
  const [credentialPage, setCredentialPage] = useState(1);
  const [editCredentialId, setEditCredentialId] = useState(null);
  const [editCredentialForm, setEditCredentialForm] = useState(createEditCredentialForm());
  const [adminForm, setAdminForm] = useState(createAdminForm());
  const [credentialForm, setCredentialForm] = useState(createCredentialForm());
  const [shareForm, setShareForm] = useState(createShareForm());
  const [accessRequestForm, setAccessRequestForm] = useState(createAccessRequestForm());
  const [adminTab, setAdminTab] = useState("department");

  const isDepartmentHead = isHeadRole(role);
  const canManage = isSuperuser || isDepartmentHead;
  const canOpenServicesTab = !canManage;
  const showVaultTab = !canManage;
  const defaultAuthenticatedPath = canManage ? "/manager" : "/vault";
  const roleLabel = isSuperuser
    ? "Супер-админ"
    : isDepartmentHead
      ? "Руководитель отдела"
      : "Сотрудник";

  useEffect(() => {
    const allowedTabs = new Set(["department", "shares", "requests", "audit", "self"]);
    const isSharedDepartmentTab = String(adminTab).startsWith("shared:");
    if (!allowedTabs.has(adminTab) && !isSharedDepartmentTab) {
      setAdminTab("department");
    }
  }, [adminTab]);

  useEffect(() => {
    if (!toast.visible) return undefined;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast.visible, toast.message]);

  useEffect(() => {
    const loadPublicDepartments = async () => {
      try {
        const departments = await apiFetchPublicDepartments();
        setPublicDepartments(Array.isArray(departments) ? departments : departments.results || []);
      } catch {
        setPublicDepartments([]);
      }
    };

    loadPublicDepartments();
    return undefined;
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const load = async () => {
      try {
        setStatus({ loading: true, error: "", mode: "live" });
        const [credentials, me, services] = await Promise.all([
          apiFetchCredentials(token),
          apiFetchMe(token),
          apiFetchServices(token)
        ]);
        const credentialItems = (Array.isArray(credentials) ? credentials : credentials.results || [])
          .slice()
          .sort(byDateDesc("updated_at"));
        setSections(groupCredentialsByService(credentialItems));
        setRequestServices(Array.isArray(services) ? services : services.results || []);
        applyAuthPayload(me);
      } catch (err) {
        setStatus({ loading: false, error: err.message, mode: "demo" });
        setSections(demoSections);
      } finally {
        setStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    load();
    return undefined;
  }, [applyAuthPayload, token]);

  useEffect(() => {
    if (!token) {
      setAccessRequests([]);
      return undefined;
    }

    const loadAccessRequests = async () => {
      try {
        const response = await apiFetchAccessRequests(token);
        setAccessRequests(
          (Array.isArray(response) ? response : response.results || [])
            .slice()
            .sort(byDateDesc("requested_at"))
        );
      } catch {
        setAccessRequests([]);
      }
    };

    loadAccessRequests();
    return undefined;
  }, [token]);

  useEffect(() => {
    if (!token || !canManage) return undefined;

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
        setAdminCredentials(
          (Array.isArray(credentials) ? credentials : credentials.results || [])
            .slice()
            .sort(byDateDesc("updated_at"))
        );
        setAdminShares(
          (Array.isArray(shares) ? shares : shares.results || [])
            .slice()
            .sort(byDateDesc("created_at"))
        );
        setAdminStatus({ loading: false, error: "", success: "" });
      } catch (err) {
        setAdminStatus({ loading: false, error: err.message, success: "" });
      }
    };

    loadUsers();
    return undefined;
  }, [token, canManage]);

  useEffect(() => {
    if (!token || !canManage) {
      setAuditLogs([]);
      return undefined;
    }

    const loadAuditLogs = async () => {
      try {
        setAuditStatus({ loading: true, error: "", success: "" });
        const response = await apiFetchAuditLogs(token, auditFilters);
        setAuditLogs(Array.isArray(response) ? response : response.results || []);
        setAuditStatus({ loading: false, error: "", success: "" });
      } catch (err) {
        setAuditLogs([]);
        setAuditStatus({ loading: false, error: err.message || "Не удалось загрузить аудит.", success: "" });
      }
    };

    loadAuditLogs();
    return undefined;
  }, [token, canManage, auditFilters]);

  useEffect(() => {
    setCredentialPage(1);
  }, [filters.credentialService]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sectionScoped = sections.filter(
      (section) => serviceFilter === "all" || String(section.id) === serviceFilter
    );

    if (!query) {
      return sectionScoped;
    }

    return sectionScoped
      .map((section) => ({
        ...section,
        services: section.services.filter((service) =>
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
            .some((field) => String(field).toLowerCase().includes(query))
        )
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

  const applyAuthData = (data) => {
    applyAuthPayload(data);
    setAdminTab("department");
    setLoginForm(createLoginForm());
    setAuthMode("login");
    setRegistrationStep("form");
    setRegistrationCode("");
    setResetStep("email");
    setResetForm(createResetForm());
    setResetCode("");
    setStatus({ loading: false, error: "", mode: "live" });
    navigate(data.is_superuser || isHeadRole(data.role) ? "/manager" : "/vault", {
      replace: true
    });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", mode: "live" });

    try {
      if (!loginForm.email.trim()) {
        throw new Error("Введите почту.");
      }
      if (!loginForm.password) {
        throw new Error("Введите пароль.");
      }

      const data = await apiLogin(loginForm.email.trim(), loginForm.password);
      applyAuthData(data);
    } catch (err) {
      setStatus({ loading: false, error: err.message, mode: "live" });
    }
  };

  const handleLogout = () => {
    logout();
    setRequestServices([]);
    setAccessRequests([]);
    setReviewComments({});
    setAccessRequestForm(createAccessRequestForm());
    setAccessRequestStatus(createMessageState());
    setOwnRequestFilters(createOwnRequestFilters());
    setReviewRequestFilters(createReviewRequestFilters());
    setServiceFilter("all");
    setAdminTab("department");
    setLoginForm(createLoginForm());
    setAuthMode("login");
    setRegistrationStep("form");
    setRegistrationCode("");
    setResetStep("email");
    setResetForm(createResetForm());
    setResetCode("");
    setRegistrationForm(createRegistrationForm());
    setRegistrationStatus(createMessageState());
    setResetStatus(createMessageState());
    navigate("/login", { replace: true });
  };

  const handleLoginFormChange = (field) => (event) => {
    setLoginForm((prev) => ({ ...prev, [field]: event.target.value }));
    setStatus((prev) => ({ ...prev, error: "" }));
  };

  const handleRegistrationChange = (field) => (event) => {
    const value = event.target.value;
    setRegistrationForm((prev) => ({
      ...prev,
      [field]: field === "iin" ? value.replace(/\D/g, "").slice(0, 12) : value
    }));
    setRegistrationStatus((prev) => ({ ...prev, error: "", success: "" }));
  };

  const handleRegisterRequest = async (event) => {
    event.preventDefault();
    setRegistrationStatus({ loading: true, error: "", success: "" });
    try {
      if (!registrationForm.email.trim()) {
        throw new Error("Введите почту.");
      }
      if (!registrationForm.iin || registrationForm.iin.length !== 12) {
        throw new Error("Введите ИИН из 12 цифр.");
      }
      if (!registrationForm.department_id) {
        throw new Error("Выберите отдел.");
      }
      if (!registrationForm.password || registrationForm.password.length < 8) {
        throw new Error("Пароль должен содержать минимум 8 символов.");
      }
      if (registrationForm.password !== registrationForm.password_confirm) {
        throw new Error("Пароли не совпадают.");
      }

      await apiRegisterRequest({
        email: registrationForm.email.trim(),
        iin: registrationForm.iin,
        department_id: Number(registrationForm.department_id),
        password: registrationForm.password,
        password_confirm: registrationForm.password_confirm
      });

      setRegistrationStep("verify");
      setRegistrationStatus({
        loading: false,
        error: "",
        success: "Код отправлен на почту. Введите его для завершения регистрации."
      });
    } catch (err) {
      setRegistrationStatus({
        loading: false,
        error: err.message || "Не удалось начать регистрацию.",
        success: ""
      });
    }
  };

  const handleRegisterVerify = async (event) => {
    event.preventDefault();
    setRegistrationStatus({ loading: true, error: "", success: "" });
    try {
      if (!registrationCode.trim()) {
        throw new Error("Введите код из письма.");
      }

      await apiRegisterVerify({
        email: registrationForm.email.trim(),
        code: registrationCode.trim()
      });

      setLoginForm({
        email: registrationForm.email.trim(),
        password: registrationForm.password
      });
      setRegistrationForm(createRegistrationForm());
      setRegistrationStep("form");
      setRegistrationCode("");
      setAuthMode("login");
      setRegistrationStatus({
        loading: false,
        error: "",
        success: "Регистрация завершена. Теперь войдите по почте и паролю."
      });
    } catch (err) {
      setRegistrationStatus({
        loading: false,
        error: err.message || "Не удалось подтвердить регистрацию.",
        success: ""
      });
    }
  };

  const handleResetFormChange = (field) => (event) => {
    setResetForm((prev) => ({ ...prev, [field]: event.target.value }));
    setResetStatus((prev) => ({ ...prev, error: "", success: "" }));
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    setResetStatus({ loading: true, error: "", success: "" });
    try {
      if (!resetForm.email.trim()) {
        throw new Error("Введите почту.");
      }
      await apiPasswordResetRequest(resetForm.email.trim());
      setResetStep("confirm");
      setResetStatus({
        loading: false,
        error: "",
        success: "Код отправлен на почту."
      });
    } catch (err) {
      setResetStatus({
        loading: false,
        error: err.message || "Не удалось отправить код.",
        success: ""
      });
    }
  };

  const handleResetConfirm = async (event) => {
    event.preventDefault();
    setResetStatus({ loading: true, error: "", success: "" });
    try {
      if (!resetCode.trim()) {
        throw new Error("Введите код из письма.");
      }
      if (!resetForm.password || resetForm.password.length < 8) {
        throw new Error("Пароль должен содержать минимум 8 символов.");
      }
      if (resetForm.password !== resetForm.password_confirm) {
        throw new Error("Пароли не совпадают.");
      }

      await apiPasswordResetConfirm({
        email: resetForm.email.trim(),
        code: resetCode.trim(),
        password: resetForm.password,
        password_confirm: resetForm.password_confirm
      });

      setLoginForm({ email: resetForm.email.trim(), password: "" });
      setResetForm(createResetForm());
      setResetCode("");
      setResetStep("email");
      setAuthMode("login");
      setResetStatus({
        loading: false,
        error: "",
        success: "Пароль обновлён. Войдите с новым паролем."
      });
    } catch (err) {
      setResetStatus({
        loading: false,
        error: err.message || "Не удалось сбросить пароль.",
        success: ""
      });
    }
  };

  const handlePasswordChangeField = (field) => (event) => {
    setPasswordChangeForm((prev) => ({ ...prev, [field]: event.target.value }));
    setPasswordChangeStatus((prev) => ({ ...prev, error: "", success: "" }));
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordChangeStatus({ loading: true, error: "", success: "" });
    try {
      if (!passwordChangeForm.current_password) {
        throw new Error("Введите текущий пароль.");
      }
      if (!passwordChangeForm.password || passwordChangeForm.password.length < 8) {
        throw new Error("Новый пароль должен содержать минимум 8 символов.");
      }
      if (passwordChangeForm.password !== passwordChangeForm.password_confirm) {
        throw new Error("Пароли не совпадают.");
      }

      await apiChangePassword(token, passwordChangeForm);
      setPasswordChangeForm(createPasswordChangeForm());
      setPasswordChangeStatus({
        loading: false,
        error: "",
        success: "Пароль успешно изменён."
      });
      setToast({ visible: true, message: "Пароль успешно изменён.", type: "success" });
      setPasswordChangeOpen(false);
    } catch (err) {
      setPasswordChangeStatus({
        loading: false,
        error: err.message || "Не удалось изменить пароль.",
        success: ""
      });
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

  const refreshAdminCredentials = async () => {
    const refreshed = await apiFetchCredentials(token);
    setAdminCredentials(
      (Array.isArray(refreshed) ? refreshed : refreshed.results || [])
        .slice()
        .sort(byDateDesc("updated_at"))
    );
  };

  const refreshAccessRequests = async () => {
    const response = await apiFetchAccessRequests(token);
    setAccessRequests(
      (Array.isArray(response) ? response : response.results || [])
        .slice()
        .sort(byDateDesc("requested_at"))
    );
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
      setAdminForm(createAdminForm());
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
        setCredentialStatus({
          loading: false,
          error: "",
          success: "У пользователя нет активных доступов"
        });
        return;
      }

      for (const credential of targets) {
        await apiUpdateCredential(token, credential.id, { is_active: false });
      }

      await refreshAdminCredentials();
      setCredentialStatus({
        loading: false,
        error: "",
        success: "Доступы пользователя сброшены"
      });
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
      setAccessRequestForm(createAccessRequestForm());
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

  const handleAuditFilterChange = (field) => (event) => {
    setAuditFilters((prev) => ({ ...prev, [field]: event.target.value }));
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
      setAdminShares(
        (Array.isArray(refreshed) ? refreshed : refreshed.results || [])
          .slice()
          .sort(byDateDesc("created_at"))
      );
      setShareForm(createShareForm());
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
      setCredentialForm(createCredentialForm());
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
      ssh_algorithm:
        credential.ssh_algorithm || (credential.secret_type === "ssh_key" ? "ed25519" : ""),
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
    setEditCredentialForm(createEditCredentialForm());
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
      setEditCredentialForm(createEditCredentialForm());
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
    () => accessRequests.filter((item) => item.requester?.portal_login === viewerLogin),
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

  const ownFilteredAccessRequests = useMemo(
    () => filterAccessRequests(ownAccessRequests, ownRequestFilters).slice().sort(byDateDesc("requested_at")),
    [ownAccessRequests, ownRequestFilters]
  );

  const filteredReviewableAccessRequests = useMemo(
    () => filterAccessRequests(reviewableAccessRequests, reviewRequestFilters).slice().sort(byDateDesc("requested_at")),
    [reviewableAccessRequests, reviewRequestFilters]
  );

  const auditActorOptions = useMemo(() => {
    const unique = new Map();
    auditLogs.forEach((item) => {
      const login = item.actor?.portal_login;
      if (!login) return;
      unique.set(login, login);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "ru"));
  }, [auditLogs]);

  const auditActionOptions = useMemo(() => {
    const unique = new Set();
    auditLogs.forEach((item) => {
      if (item.action) unique.add(item.action);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "ru"));
  }, [auditLogs]);

  const auditObjectTypeOptions = useMemo(() => {
    const unique = new Set();
    auditLogs.forEach((item) => {
      if (item.object_type) unique.add(item.object_type);
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "ru"));
  }, [auditLogs]);

  const exportAccessRequestsCsv = (items, prefix) => {
    try {
      const headers = [
        "Запрошено",
        "ID",
        "Статус",
        "Сервис",
        "Запросил",
        "Ревьюер",
        "Обоснование",
        "Комментарий ревьюера",
        "Рассмотрено"
      ];
      const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
      const rows = items.map((item) => [
        item.requested_at ? new Date(item.requested_at).toLocaleString("ru-RU") : "",
        item.id,
        ACCESS_REQUEST_STATUS_LABEL[item.status] || item.status,
        item.service?.name || "",
        item.requester?.portal_login || "",
        item.reviewer?.portal_login || "",
        item.justification || "",
        item.review_comment || "",
        item.reviewed_at ? new Date(item.reviewed_at).toLocaleString("ru-RU") : ""
      ]);
      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsv).join(","))
        .join("\n");
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

  const handleExportAuditLogs = async () => {
    try {
      await apiExportAuditLogsCsv(token, auditFilters);
      showToast("CSV аудит выгружен");
    } catch {
      showToast("Не удалось выгрузить аудит", "error");
    }
  };

  const headCandidates = adminUsers.filter(
    (user) => isHeadRole(user.role) && !user.is_superuser && user.portal_login !== viewerLogin
  );

  const writableUsers = adminUsers.filter((user) => {
    if (user.is_superuser) return false;
    if (isHeadRole(user.role)) return false;
    if (isSuperuser) return true;
    return Number(user.department?.id || 0) === viewerDepartmentId;
  });

  const departmentUsers = writableUsers.filter((user) =>
    isSuperuser ? true : Number(user.department?.id || 0) === viewerDepartmentId
  );

  const canWriteForUser = (user) => {
    if (isSuperuser) return true;
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

  return {
    isAuthenticated,
    canManage,
    canOpenServicesTab,
    showVaultTab,
    defaultAuthenticatedPath,
    roleLabel,
    toast,
    handleLogout,
    authPageProps: {
      status,
      loginForm,
      onLoginFormChange: handleLoginFormChange,
      onLogin: handleLogin,
      authMode,
      onAuthModeChange: setAuthMode,
      registrationForm,
      registrationStep,
      registrationCode,
      onRegistrationCodeChange: (event) => setRegistrationCode(event.target.value),
      registrationStatus,
      publicDepartments,
      onRegistrationChange: handleRegistrationChange,
      onRegisterRequest: handleRegisterRequest,
      onRegisterVerify: handleRegisterVerify,
      onRegistrationBack: () => {
        setRegistrationStep("form");
        setRegistrationCode("");
        setRegistrationStatus(createMessageState());
      },
      resetForm,
      resetStep,
      resetCode,
      onResetFormChange: handleResetFormChange,
      onResetCodeChange: (event) => setResetCode(event.target.value),
      resetStatus,
      onResetRequest: handleResetRequest,
      onResetConfirm: handleResetConfirm,
      onResetBack: () => {
        setResetStep("email");
        setResetCode("");
        setResetStatus(createMessageState());
      },
      onOpenReset: () => {
        setResetForm((prev) => ({ ...createResetForm(), email: loginForm.email || prev.email }));
        setResetStep("email");
        setResetCode("");
        setResetStatus(createMessageState());
      },
      onBackToLogin: () => {
        setRegistrationStep("form");
        setRegistrationCode("");
        setResetStep("email");
        setResetCode("");
        setRegistrationStatus(createMessageState());
        setResetStatus(createMessageState());
      }
    },
    passwordChangeProps: {
      open: passwordChangeOpen,
      onOpen: () => {
        setPasswordChangeForm(createPasswordChangeForm());
        setPasswordChangeStatus(createMessageState());
        setPasswordChangeOpen(true);
      },
      onClose: () => setPasswordChangeOpen(false),
      form: passwordChangeForm,
      onChange: handlePasswordChangeField,
      onSubmit: handlePasswordChange,
      status: passwordChangeStatus
    },
    sidebarProps: {
      viewerFullName,
      viewerDepartment,
      roleLabel,
      canOpenServicesTab,
      showVaultTab
    },
    vaultPageProps: {
      serviceGroupsCount: sections.length,
      search,
      onSearchChange: setSearch,
      serviceFilter,
      onServiceFilterChange: setServiceFilter,
      serviceOptions,
      filteredSections,
      onCopyField: handleCopyCredentialValue,
      onDownloadCredentialSecret: handleDownloadCredentialSecret
    },
    servicesPageProps: {
      requestableServices,
      accessRequestForm,
      onAccessRequestChange: handleAccessRequestChange,
      onCreateAccessRequest: handleCreateAccessRequest,
      accessRequestStatus,
      ownAccessRequests: ownFilteredAccessRequests,
      ownAccessRequestsTotal: ownAccessRequests.length,
      ownRequestFilters,
      ownRequestServiceOptions,
      onOwnRequestFilterChange: handleOwnRequestFilterChange,
      onExportOwnRequestsCsv: () =>
        exportAccessRequestsCsv(ownFilteredAccessRequests, "my_access_requests"),
      onCancelAccessRequest: handleCancelAccessRequest
    },
    managerPageProps: {
      isSuperuser,
      adminTab,
      onAdminTabChange: setAdminTab,
      adminForm,
      onAdminChange: handleAdminChange,
      onGenerateLogin: handleGenerateLogin,
      adminDepartments,
      adminStatus,
      onCreateUser: handleCreateUser,
      onEditUser: handleEditUser,
      onDeactivateUser: handleDeactivateUser,
      onResetUserAccess: handleResetUserAccess,
      shareForm,
      onShareChange: handleShareChange,
      headCandidates,
      shareStatus,
      onCreateShare: handleCreateShare,
      activeShares,
      canRevokeShare,
      onDeleteShare: handleDeleteShare,
      writableUsers,
      adminServices,
      filters,
      onFilterChange: handleFilterChange,
      canWriteForUser,
      isDepartmentHead,
      viewerUserId,
      viewerFullName,
      viewerDepartment,
      roleLabel,
      credentialForm,
      onCredentialChange: handleCredentialChange,
      onCredentialFileChange: handleCredentialFileChange,
      credentialStatus,
      onCreateCredential: handleCreateCredential,
      editCredentialId,
      editCredentialForm,
      onEditCredentialChange: handleEditCredentialChange,
      onSaveCredential: handleSaveCredential,
      onCancelEditCredential: handleCancelEditCredential,
      onStartEditCredential: handleStartEditCredential,
      onToggleCredential: handleToggleCredential,
      onDeleteCredential: handleDeleteCredential,
      onDownloadCredentialSecret: handleDownloadCredentialSecret,
      credentialPage,
      setCredentialPage,
      adminUsers: departmentUsers,
      accessRequests: filteredReviewableAccessRequests,
      accessRequestsTotal: reviewableAccessRequests.length,
      accessRequestStatus,
      onApproveAccessRequest: handleApproveWithComment,
      onRejectAccessRequest: handleRejectWithComment,
      reviewComments,
      onReviewCommentChange: handleReviewCommentChange,
      reviewRequestFilters,
      reviewRequestServiceOptions,
      onReviewRequestFilterChange: handleReviewRequestFilterChange,
      onExportAccessRequestsCsv: () =>
        exportAccessRequestsCsv(
          filteredReviewableAccessRequests,
          "department_access_requests"
        ),
      auditLogs,
      auditStatus,
      auditFilters,
      auditActorOptions,
      auditActionOptions,
      auditObjectTypeOptions,
      onAuditFilterChange: handleAuditFilterChange,
      onExportAuditLogs: handleExportAuditLogs,
      adminCredentials,
      selfCredentials
    }
  };
}
