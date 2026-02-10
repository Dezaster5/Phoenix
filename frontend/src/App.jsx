import { useEffect, useMemo, useState } from "react";
import {
  apiCreateAccess,
  apiCreateCredential,
  apiCreateUser,
  apiDeleteAccess,
  apiDeleteCredential,
  apiFetchAccesses,
  apiFetchCredentials,
  apiFetchServices,
  apiFetchUsers,
  apiLogin,
  apiUpdateAccess,
  apiUpdateCredential
} from "./api";
import { demoSections } from "./data/demo";

const formatUrl = (url) => url.replace(/^https?:\/\//, "");

const accentClass = {
  sunset: "accent-sunset",
  sky: "accent-sky",
  mint: "accent-mint"
};

const groupCredentials = (credentials) => {
  const grouped = new Map();

  credentials.forEach((cred) => {
    const category = cred.service.category || { id: "none", name: "Без категории" };
    if (!grouped.has(category.id)) {
      grouped.set(category.id, {
        id: category.id,
        name: category.name,
        tagline: "Назначенные сервисы",
        accent: "sky",
        services: []
      });
    }

    grouped.get(category.id).services.push({
      id: cred.id,
      name: cred.service.name,
      url: cred.service.url,
      login: cred.login,
      password: cred.password,
      notes: cred.notes
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

export default function App() {
  const [portalLogin, setPortalLogin] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("phoenixToken") || "");
  const [role, setRole] = useState(localStorage.getItem("phoenixRole") || "employee");
  const [sections, setSections] = useState(demoSections);
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState({});
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState({ loading: false, error: "", mode: "demo" });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [adminAccesses, setAdminAccesses] = useState([]);
  const [adminCredentials, setAdminCredentials] = useState([]);
  const [adminStatus, setAdminStatus] = useState({ loading: false, error: "", success: "" });
  const [accessStatus, setAccessStatus] = useState({ loading: false, error: "", success: "" });
  const [credentialStatus, setCredentialStatus] = useState({
    loading: false,
    error: "",
    success: ""
  });
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
    role: "employee"
  });
  const [accessForm, setAccessForm] = useState({ user_id: "", service_id: "" });
  const [credentialForm, setCredentialForm] = useState({
    user_id: "",
    service_id: "",
    login: "",
    password: "",
    notes: ""
  });

  const isAuthenticated = Boolean(token);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setStatus({ loading: true, error: "", mode: "live" });
        const credentials = await apiFetchCredentials(token);
        setSections(groupCredentials(credentials));
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
    if (!token || !isAdmin) return;

    const loadUsers = async () => {
      try {
        setAdminStatus({ loading: true, error: "", success: "" });
        const [users, services, accesses, credentials] = await Promise.all([
          apiFetchUsers(token),
          apiFetchServices(token),
          apiFetchAccesses(token),
          apiFetchCredentials(token)
        ]);
        setAdminUsers(Array.isArray(users) ? users : users.results || []);
        setAdminServices(Array.isArray(services) ? services : services.results || []);
        setAdminAccesses(Array.isArray(accesses) ? accesses : accesses.results || []);
        setAdminCredentials(Array.isArray(credentials) ? credentials : credentials.results || []);
        setAdminStatus({ loading: false, error: "", success: "" });
      } catch (err) {
        setAdminStatus({ loading: false, error: err.message, success: "" });
      }
    };

    loadUsers();
  }, [token, isAdmin]);

  useEffect(() => {
    setAccessPage(1);
  }, [filters.accessUser, filters.accessService]);

  useEffect(() => {
    setCredentialPage(1);
  }, [filters.credentialUser, filters.credentialService]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const query = search.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        services: section.services.filter((service) =>
          [service.name, service.url, service.login].some((field) =>
            field.toLowerCase().includes(query)
          )
        )
      }))
      .filter((section) => section.services.length > 0);
  }, [sections, search]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", mode: "live" });

    try {
      const data = await apiLogin(portalLogin);
      localStorage.setItem("phoenixToken", data.token);
      localStorage.setItem("phoenixRole", data.role);
      setToken(data.token);
      setRole(data.role);
      setPortalLogin("");
    } catch (err) {
      setStatus({ loading: false, error: err.message, mode: "demo" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("phoenixToken");
    localStorage.removeItem("phoenixRole");
    setToken("");
    setRole("employee");
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
      const payload = {
        portal_login: adminForm.portal_login.trim(),
        full_name: adminForm.full_name.trim(),
        email: adminForm.email.trim(),
        role: adminForm.role,
        is_active: true
      };
      const created = await apiCreateUser(token, payload);
      setAdminUsers((prev) => [created, ...prev]);
      setAdminForm({ portal_login: "", full_name: "", email: "", role: "employee" });
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

      <header className="site-header">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <span className="brand-ring" />
              <span className="brand-letter">A</span>
            </div>
            <div>
              <div className="brand-title">avatariya</div>
              <div className="brand-subtitle">vault access</div>
            </div>
          </div>
          <div className="topbar-actions">
            {isAuthenticated && (
              <>
                <div className="role-chip">Роль: {role === "admin" ? "админ" : "сотрудник"}</div>
                <button className="btn btn-ghost" type="button" onClick={handleLogout}>
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-decor" aria-hidden="true">
          <span className="hero-ribbon" />
          <span className="hero-orb" />
        </div>
        <div className="hero-info">
          <div className="tag">внутренний доступ</div>
          <h1>
            Все рабочие логины
            <span>в стиле Avatariya</span>
          </h1>
          <p>
            Phoenix Vault показывает только те сервисы, которые закреплены за вашим
            профилем. Никаких лишних прав, только нужные доступы и порядок.
          </p>
          <div className="hero-stats">
            <div className="stat-card">
              <div className="stat-value">{totalServices}</div>
              <div className="stat-label">Сервисов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{sections.length}</div>
              <div className="stat-label">Категорий</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Доступ</div>
            </div>
          </div>
        </div>

        {!isAuthenticated ? (
          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-header">
              <div>
                <div className="login-title">Вход по логину</div>
                <div className="login-subtitle">Логин выдаёт администратор</div>
              </div>
              <div className={`mode-chip ${status.mode === "demo" ? "mode-demo" : "mode-live"}`}>
                {status.mode === "demo" ? "демо" : "онлайн"}
              </div>
            </div>
            <label>
              Логин Phoenix
              <input
                type="text"
                value={portalLogin}
                onChange={(event) => setPortalLogin(event.target.value)}
                placeholder="например, marketing.team"
              />
            </label>
            {status.error && <div className="login-error">{status.error}</div>}
            <button className="btn btn-primary" type="submit" disabled={status.loading}>
              {status.loading ? "Проверяем..." : "Войти"}
            </button>
            <p className="login-hint">
              Если логина ещё нет — отправьте запрос администратору.
            </p>
          </form>
        ) : (
          <div className="access-card">
            <div className="access-title">Доступ активен</div>
            <p>Вы вошли как {role === "admin" ? "админ" : "сотрудник"}.</p>
            <div className="access-metrics">
              <div>
                <strong>{totalServices}</strong>
                <span>сервисов</span>
              </div>
              <div>
                <strong>{sections.length}</strong>
                <span>категорий</span>
              </div>
            </div>
            <button className="btn btn-accent" type="button" onClick={handleLogout}>
              Выйти из аккаунта
            </button>
          </div>
        )}
      </section>

      {!isAuthenticated ? (
        <section className="request-block">
          <div className="request-card">
            <h2>Нет логина?</h2>
            <p>
              Отправьте запрос администратору. Мы подготовили шаблон письма, чтобы
              быстрее подтвердить доступ.
            </p>
            <div className="request-actions">
              <a
                className="btn btn-outline"
                href={`mailto:${requestEmail}?subject=${encodeURIComponent(
                  requestSubject
                )}&body=${encodeURIComponent(requestTemplate)}`}
              >
                Отправить письмо
              </a>
              <button className="btn btn-accent" type="button" onClick={handleCopyTemplate}>
                {copied ? "Скопировано" : "Скопировать шаблон"}
              </button>
            </div>
            <pre className="request-template">{requestTemplate}</pre>
          </div>
        </section>
      ) : (
        <>
          <section className="toolbar">
            <div className="toolbar-left">
              <h2>Мои сервисы</h2>
              <span className="subtitle">Доступы, назначенные вашему профилю</span>
            </div>
            <div className="toolbar-right">
              <div className="search">
                <input
                  type="search"
                  placeholder="Поиск по сервису, логину или ссылке"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <span className="search-icon">⌕</span>
              </div>
            </div>
          </section>

          <main className="sections">
            {filteredSections.length === 0 ? (
              <div className="empty-state">
                <h3>Сервисы ещё не назначены</h3>
                <p>Свяжитесь с администратором, чтобы получить доступ.</p>
              </div>
            ) : (
              filteredSections.map((section) => (
                <div
                  key={section.id}
                  className={`section ${accentClass[section.accent] || "accent-sky"}`}
                >
                  <div className="section-header">
                    <div>
                      <h3>{section.name}</h3>
                      <p>{section.tagline}</p>
                    </div>
                    <div className="section-count">{section.services.length} сервиса</div>
                  </div>
                  <div className="service-grid">
                    {section.services.map((service) => (
                      <article key={service.id} className="service-card">
                        <div className="service-head">
                          <div className="service-icon">{service.name.slice(0, 1)}</div>
                          <div>
                            <div className="service-name">{service.name}</div>
                            <div className="service-url">{formatUrl(service.url)}</div>
                          </div>
                          <a
                            className="btn btn-mini"
                            href={service.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть
                          </a>
                        </div>
                        <div className="service-body">
                          <div className="cred">
                            <span>Логин</span>
                            <strong>{service.login}</strong>
                          </div>
                          <div className="cred">
                            <span>Пароль</span>
                            <strong>{revealed[service.id] ? service.password : "••••••••"}</strong>
                            <button
                              className="reveal"
                              type="button"
                              onClick={() => toggleReveal(service.id)}
                            >
                              {revealed[service.id] ? "Скрыть" : "Показать"}
                            </button>
                          </div>
                          {service.notes && <div className="notes">{service.notes}</div>}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))
            )}
          </main>
        </>
      )}

      {isAuthenticated && isAdmin && (
        <section className="admin-panel">
          <div className="admin-card">
            <div className="admin-header">
              <h2>Админ панель</h2>
              <span>Создание сотрудников и выдача логинов</span>
            </div>
            <form className="admin-form" onSubmit={handleCreateUser}>
              <label>
                ФИО
                <input
                  type="text"
                  value={adminForm.full_name}
                  onChange={handleAdminChange("full_name")}
                  placeholder="Например, Иван Иванов"
                />
              </label>
              <label>
                Почта
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={handleAdminChange("email")}
                  placeholder="name@avatariya.com"
                />
              </label>
              <label>
                Логин Phoenix
                <div className="login-inline">
                  <input
                    type="text"
                    value={adminForm.portal_login}
                    onChange={handleAdminChange("portal_login")}
                    placeholder="например, ivan.ivanov"
                    required
                  />
                  <button className="btn btn-ghost" type="button" onClick={handleGenerateLogin}>
                    Сгенерировать
                  </button>
                </div>
              </label>
              <label>
                Роль
                <select value={adminForm.role} onChange={handleAdminChange("role")}>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Админ</option>
                </select>
              </label>
              {adminStatus.error && <div className="login-error">{adminStatus.error}</div>}
              {adminStatus.success && <div className="admin-success">{adminStatus.success}</div>}
              <button className="btn btn-primary" type="submit" disabled={adminStatus.loading}>
                {adminStatus.loading ? "Сохраняем..." : "Создать пользователя"}
              </button>
            </form>
          </div>
          <div className="admin-card">
            <div className="admin-header">
              <h2>Доступы к сервисам</h2>
              <span>Назначьте пользователю доступ к сервису</span>
            </div>
            <form className="admin-form" onSubmit={handleCreateAccess}>
              <label>
                Сотрудник
                <select value={accessForm.user_id} onChange={handleAccessChange("user_id")}>
                  <option value="">Выберите сотрудника</option>
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.portal_login} {user.full_name ? `(${user.full_name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Сервис
                <select value={accessForm.service_id} onChange={handleAccessChange("service_id")}>
                  <option value="">Выберите сервис</option>
                  {adminServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              {accessStatus.error && <div className="login-error">{accessStatus.error}</div>}
              {accessStatus.success && <div className="admin-success">{accessStatus.success}</div>}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={accessStatus.loading || !accessForm.user_id || !accessForm.service_id}
              >
                {accessStatus.loading ? "Назначаем..." : "Назначить доступ"}
              </button>
            </form>
            <div className="admin-filters">
              <select value={filters.accessUser} onChange={handleFilterChange("accessUser")}>
                <option value="all">Все сотрудники</option>
                {adminUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.portal_login}
                  </option>
                ))}
              </select>
              <select value={filters.accessService} onChange={handleFilterChange("accessService")}>
                <option value="all">Все сервисы</option>
                {adminServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-list">
              {pagedAccesses.map((access) => (
                <div key={access.id} className="admin-user">
                  <div>
                    <strong>{access.user?.portal_login}</strong>
                    <span>{access.service?.name}</span>
                  </div>
                  <div className="admin-meta">
                    <span className={`status-pill ${access.is_active ? "active" : "inactive"}`}>
                      {access.is_active ? "активен" : "выключен"}
                    </span>
                    <button
                      className="btn btn-mini"
                      type="button"
                      onClick={() => handleToggleAccess(access)}
                    >
                      {access.is_active ? "Выключить" : "Включить"}
                    </button>
                    <button
                      className="btn btn-mini danger"
                      type="button"
                      onClick={() => handleDeleteAccess(access)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
              {filteredAccesses.length === 0 && (
                <div className="empty-state">Доступы ещё не назначены.</div>
              )}
            </div>
            <div className="admin-pagination">
              <button
                className="btn btn-mini"
                type="button"
                disabled={accessPage === 1}
                onClick={() => setAccessPage((prev) => Math.max(1, prev - 1))}
              >
                Назад
              </button>
              <span>
                {accessPage} / {accessTotalPages}
              </span>
              <button
                className="btn btn-mini"
                type="button"
                disabled={accessPage === accessTotalPages}
                onClick={() =>
                  setAccessPage((prev) => Math.min(accessTotalPages, prev + 1))
                }
              >
                Вперёд
              </button>
            </div>
          </div>
          <div className="admin-card">
            <div className="admin-header">
              <h2>Креды сервисов</h2>
              <span>Логин и пароль для доступа к сервису</span>
            </div>
            <form className="admin-form" onSubmit={handleCreateCredential}>
              <label>
                Сотрудник
                <select value={credentialForm.user_id} onChange={handleCredentialChange("user_id")}>
                  <option value="">Выберите сотрудника</option>
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.portal_login} {user.full_name ? `(${user.full_name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Сервис
                <select
                  value={credentialForm.service_id}
                  onChange={handleCredentialChange("service_id")}
                >
                  <option value="">Выберите сервис</option>
                  {adminServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Логин сервиса
                <input
                  type="text"
                  value={credentialForm.login}
                  onChange={handleCredentialChange("login")}
                  placeholder="login@example.com"
                />
              </label>
              <label>
                Пароль сервиса
                <input
                  type="text"
                  value={credentialForm.password}
                  onChange={handleCredentialChange("password")}
                  placeholder="пароль от сервиса"
                />
              </label>
              <label>
                Примечание
                <input
                  type="text"
                  value={credentialForm.notes}
                  onChange={handleCredentialChange("notes")}
                  placeholder="например, доступ только для чтения"
                />
              </label>
              {credentialStatus.error && <div className="login-error">{credentialStatus.error}</div>}
              {credentialStatus.success && (
                <div className="admin-success">{credentialStatus.success}</div>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  credentialStatus.loading ||
                  !credentialForm.user_id ||
                  !credentialForm.service_id ||
                  !credentialForm.login.trim() ||
                  !credentialForm.password
                }
              >
                {credentialStatus.loading ? "Сохраняем..." : "Сохранить креды"}
              </button>
            </form>
            <div className="admin-filters">
              <select value={filters.credentialUser} onChange={handleFilterChange("credentialUser")}>
                <option value="all">Все сотрудники</option>
                {adminUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.portal_login}
                  </option>
                ))}
              </select>
              <select
                value={filters.credentialService}
                onChange={handleFilterChange("credentialService")}
              >
                <option value="all">Все сервисы</option>
                {adminServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-list">
              {pagedCredentials.map((credential) => (
                <div key={credential.id} className="admin-user admin-credential">
                  <div>
                    <strong>{credential.user?.portal_login}</strong>
                    <span>{credential.service?.name}</span>
                  </div>
                  {editCredentialId === credential.id ? (
                    <div className="admin-edit">
                      <input
                        type="text"
                        value={editCredentialForm.login}
                        onChange={handleEditCredentialChange("login")}
                        placeholder="Логин сервиса"
                      />
                      <input
                        type="text"
                        value={editCredentialForm.password}
                        onChange={handleEditCredentialChange("password")}
                        placeholder="Пароль сервиса"
                      />
                      <input
                        type="text"
                        value={editCredentialForm.notes}
                        onChange={handleEditCredentialChange("notes")}
                        placeholder="Примечание"
                      />
                    </div>
                  ) : (
                    <div className="admin-summary">
                      <span>Логин: {credential.login}</span>
                      <span>Пароль: {credential.password}</span>
                      {credential.notes && <span>Заметка: {credential.notes}</span>}
                    </div>
                  )}
                  <div className="admin-meta">
                    <span className={`status-pill ${credential.is_active ? "active" : "inactive"}`}>
                      {credential.is_active ? "активен" : "выключен"}
                    </span>
                    {editCredentialId === credential.id ? (
                      <>
                        <button
                          className="btn btn-mini"
                          type="button"
                          onClick={() => handleSaveCredential(credential)}
                        >
                          Сохранить
                        </button>
                        <button
                          className="btn btn-mini danger"
                          type="button"
                          onClick={handleCancelEditCredential}
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-mini"
                          type="button"
                          onClick={() => handleStartEditCredential(credential)}
                        >
                          Изменить
                        </button>
                        <button
                          className="btn btn-mini"
                          type="button"
                          onClick={() => handleToggleCredential(credential)}
                        >
                          {credential.is_active ? "Выключить" : "Включить"}
                        </button>
                        <button
                          className="btn btn-mini danger"
                          type="button"
                          onClick={() => handleDeleteCredential(credential)}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filteredCredentials.length === 0 && (
                <div className="empty-state">Креды ещё не добавлены.</div>
              )}
            </div>
            <div className="admin-pagination">
              <button
                className="btn btn-mini"
                type="button"
                disabled={credentialPage === 1}
                onClick={() => setCredentialPage((prev) => Math.max(1, prev - 1))}
              >
                Назад
              </button>
              <span>
                {credentialPage} / {credentialTotalPages}
              </span>
              <button
                className="btn btn-mini"
                type="button"
                disabled={credentialPage === credentialTotalPages}
                onClick={() =>
                  setCredentialPage((prev) => Math.min(credentialTotalPages, prev + 1))
                }
              >
                Вперёд
              </button>
            </div>
          </div>
          <div className="admin-card">
            <h3>Пользователи</h3>
            <div className="admin-users">
              {adminUsers.length === 0 ? (
                <div className="empty-state">Пользователей пока нет.</div>
              ) : (
                adminUsers.map((user) => (
                  <div key={user.id} className="admin-user">
                    <div>
                      <strong>{user.portal_login}</strong>
                      <span>{user.full_name || "Без имени"}</span>
                    </div>
                    <div className="admin-meta">
                      <span className="role-pill">
                        {user.role === "admin" ? "админ" : "сотрудник"}
                      </span>
                      <span className={`status-pill ${user.is_active ? "active" : "inactive"}`}>
                        {user.is_active ? "активен" : "неактивен"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        <div>
          <strong>Phoenix Vault</strong>
          <span>Внутренний сервис доступа Avatariya</span>
        </div>
      </footer>
    </div>
  );
}
