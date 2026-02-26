import { useEffect, useMemo, useState } from "react";

const PASSWORD_VISIBLE_MS = 10000;
const PAGE_SIZE = 6;

const formatDateTime = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("ru-RU");
};

const getSecretTypeLabel = (secretType) => {
  if (secretType === "ssh_key") return "SSH ключ";
  if (secretType === "api_token") return "API токен";
  return "Пароль";
};

const getSecretValueLabel = (secretType) => (secretType === "ssh_key" ? "Ключ" : "Пароль");

const requestStatusLabel = {
  pending: "На рассмотрении",
  approved: "Одобрен",
  rejected: "Отклонен",
  canceled: "Отменен"
};

const getRequestBadgeClass = (status) => {
  if (status === "approved") return "status-badge status-approved";
  if (status === "rejected") return "status-badge status-rejected";
  if (status === "pending") return "status-badge status-pending";
  return "status-badge status-muted";
};

const getRequestBadgeIcon = (status) => {
  if (status === "approved") return "✓";
  if (status === "rejected") return "✕";
  if (status === "pending") return "⏳";
  return "•";
};

const getSecretPreview = (value) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= 28) return normalized;
  return `${normalized.slice(0, 28)}…`;
};

export default function AdminPanel({
  isSuperuser,
  isDepartmentHead,
  viewerUserId,
  viewerFullName,
  viewerDepartment,
  roleLabel,
  adminTab,
  onAdminTabChange,
  adminForm,
  onAdminChange,
  onGenerateLogin,
  adminDepartments,
  adminStatus,
  onCreateUser,
  onEditUser,
  onDeactivateUser,
  onResetUserAccess,
  shareForm,
  onShareChange,
  headCandidates,
  shareStatus,
  onCreateShare,
  activeShares,
  canRevokeShare,
  onDeleteShare,
  writableUsers,
  adminServices,
  filters,
  onFilterChange,
  canWriteForUser,
  credentialForm,
  onCredentialChange,
  onCredentialFileChange,
  credentialStatus,
  onCreateCredential,
  editCredentialId,
  editCredentialForm,
  onEditCredentialChange,
  onSaveCredential,
  onCancelEditCredential,
  onStartEditCredential,
  onToggleCredential,
  onDeleteCredential,
  onDownloadCredentialSecret,
  credentialPage,
  setCredentialPage,
  adminUsers,
  accessRequests,
  accessRequestsTotal,
  accessRequestStatus,
  onApproveAccessRequest,
  onRejectAccessRequest,
  reviewComments,
  onReviewCommentChange,
  reviewRequestFilters,
  reviewRequestServiceOptions,
  onReviewRequestFilterChange,
  onExportAccessRequestsCsv,
  adminCredentials,
  selfCredentials
}) {
  const [showUserCreate, setShowUserCreate] = useState(false);
  const [showShareCreate, setShowShareCreate] = useState(false);
  const [showCredentialCreate, setShowCredentialCreate] = useState(false);

  const [usersQuery, setUsersQuery] = useState("");
  const [sharesQuery, setSharesQuery] = useState("");
  const [credentialQuery, setCredentialQuery] = useState("");
  const [selfQuery, setSelfQuery] = useState("");
  const [sharedQuery, setSharedQuery] = useState("");

  const [selectedCredentialUserId, setSelectedCredentialUserId] = useState("");
  const [credentialDetails, setCredentialDetails] = useState(null);
  const [openCredentialMenu, setOpenCredentialMenu] = useState(null);
  const [openUserMenu, setOpenUserMenu] = useState(null);

  const [nowTs, setNowTs] = useState(Date.now());
  const [passwordVisibleUntil, setPasswordVisibleUntil] = useState({});

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeMenus = () => {
      setOpenCredentialMenu(null);
      setOpenUserMenu(null);
    };
    window.addEventListener("scroll", closeMenus, true);
    window.addEventListener("resize", closeMenus);
    window.addEventListener("click", closeMenus);
    return () => {
      window.removeEventListener("scroll", closeMenus, true);
      window.removeEventListener("resize", closeMenus);
      window.removeEventListener("click", closeMenus);
    };
  }, []);

  useEffect(() => {
    if (adminStatus.success) setShowUserCreate(false);
  }, [adminStatus.success]);

  useEffect(() => {
    if (shareStatus.success) setShowShareCreate(false);
  }, [shareStatus.success]);

  useEffect(() => {
    if (credentialStatus.success) {
      setShowCredentialCreate(false);
      setOpenCredentialMenu(null);
    }
  }, [credentialStatus.success]);

  const pendingRequestsCount = useMemo(
    () => (accessRequests || []).filter((item) => item.status === "pending").length,
    [accessRequests]
  );

  const tabs = [
    { id: "department", label: "Мой отдел" },
    { id: "shares", label: "Доступ отдела" },
    { id: "requests", label: "Заявки", badge: pendingRequestsCount }
  ];

  useEffect(() => {
    if (adminTab === "self" && !(isDepartmentHead && !isSuperuser)) {
      onAdminTabChange("department");
    }
  }, [adminTab, isDepartmentHead, isSuperuser, onAdminTabChange]);

  const receivedDepartmentShares = useMemo(
    () =>
      (activeShares || []).filter(
        (share) =>
          Number(share.grantee?.id || 0) === Number(viewerUserId || 0) &&
          Number(share.department?.id || 0) > 0
      ),
    [activeShares, viewerUserId]
  );

  const selectedSharedDepartment = useMemo(() => {
    if (!String(adminTab).startsWith("shared:")) {
      return null;
    }
    const shareId = Number(String(adminTab).split(":")[1] || 0);
    return receivedDepartmentShares.find((share) => share.id === shareId) || null;
  }, [adminTab, receivedDepartmentShares]);

  useEffect(() => {
    if (String(adminTab).startsWith("shared:") && !selectedSharedDepartment) {
      onAdminTabChange("department");
    }
  }, [adminTab, selectedSharedDepartment, onAdminTabChange]);

  const filteredDepartmentUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((user) =>
      [user.portal_login, user.full_name, user.email, user.department?.name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [adminUsers, usersQuery]);

  const filteredShares = useMemo(() => {
    const q = sharesQuery.trim().toLowerCase();
    if (!q) return activeShares;
    return activeShares.filter((share) =>
      [share.department?.name, share.grantor?.portal_login, share.grantee?.portal_login]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [activeShares, sharesQuery]);

  const credentialUsers = useMemo(() => {
    const counter = new Map();
    (adminCredentials || []).forEach((item) => {
      const userId = item.user?.id;
      if (!userId) return;
      counter.set(userId, (counter.get(userId) || 0) + 1);
    });

    return filteredDepartmentUsers.map((user) => ({
      ...user,
      credentials_count: counter.get(user.id) || 0
    }));
  }, [adminCredentials, filteredDepartmentUsers]);

  useEffect(() => {
    if (!credentialUsers.length) {
      setSelectedCredentialUserId("");
      return;
    }
    const exists = credentialUsers.some((user) => String(user.id) === String(selectedCredentialUserId));
    if (!exists) {
      setSelectedCredentialUserId(String(credentialUsers[0].id));
    }
  }, [credentialUsers, selectedCredentialUserId]);

  const selectedCredentialUser = useMemo(
    () => credentialUsers.find((user) => String(user.id) === String(selectedCredentialUserId)) || null,
    [credentialUsers, selectedCredentialUserId]
  );

  const filteredCredentialsForSelectedUser = useMemo(() => {
    const q = credentialQuery.trim().toLowerCase();
    return (adminCredentials || []).filter((credential) => {
      if (selectedCredentialUserId && String(credential.user?.id) !== String(selectedCredentialUserId)) {
        return false;
      }
      if (
        filters.credentialService !== "all" &&
        String(credential.service?.id) !== String(filters.credentialService)
      ) {
        return false;
      }
      if (!q) return true;
      return [
        credential.service?.name,
        credential.login,
        credential.notes,
        credential.secret_type,
        credential.ssh_host,
        credential.ssh_fingerprint
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [adminCredentials, credentialQuery, filters.credentialService, selectedCredentialUserId]);

  const selectedCredentialTotalPages = Math.max(
    1,
    Math.ceil(filteredCredentialsForSelectedUser.length / PAGE_SIZE)
  );
  const credentialStartIndex = (credentialPage - 1) * PAGE_SIZE;
  const pagedCredentialsForSelectedUser = filteredCredentialsForSelectedUser.slice(
    credentialStartIndex,
    credentialStartIndex + PAGE_SIZE
  );

  useEffect(() => {
    if (credentialPage > selectedCredentialTotalPages) {
      setCredentialPage(selectedCredentialTotalPages);
    }
  }, [credentialPage, selectedCredentialTotalPages, setCredentialPage]);

  const filteredSelfCredentials = useMemo(() => {
    const q = selfQuery.trim().toLowerCase();
    return (selfCredentials || []).filter((credential) => {
      if (filters.credentialService !== "all" && String(credential.service?.id) !== String(filters.credentialService)) {
        return false;
      }
      if (!q) return true;
      return [credential.service?.name, credential.login, credential.notes, credential.secret_type]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [selfCredentials, selfQuery, filters.credentialService]);

  const selfTotalPages = Math.max(1, Math.ceil(filteredSelfCredentials.length / PAGE_SIZE));
  const selfPageRows = filteredSelfCredentials.slice((credentialPage - 1) * PAGE_SIZE, credentialPage * PAGE_SIZE);

  const filteredSharedCredentials = useMemo(() => {
    if (!selectedSharedDepartment) {
      return [];
    }
    const sharedDepartmentId = Number(selectedSharedDepartment.department?.id || 0);
    const q = sharedQuery.trim().toLowerCase();

    return (adminCredentials || []).filter((credential) => {
      if (Number(credential.user?.department?.id || 0) !== sharedDepartmentId) {
        return false;
      }
      if (
        filters.credentialService !== "all" &&
        String(credential.service?.id) !== String(filters.credentialService)
      ) {
        return false;
      }
      if (!q) return true;
      return [credential.service?.name, credential.login, credential.notes, credential.secret_type]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [selectedSharedDepartment, sharedQuery, adminCredentials, filters.credentialService]);

  const sharedTotalPages = Math.max(1, Math.ceil(filteredSharedCredentials.length / PAGE_SIZE));
  const sharedPageRows = filteredSharedCredentials.slice(
    (credentialPage - 1) * PAGE_SIZE,
    credentialPage * PAGE_SIZE
  );

  useEffect(() => {
    if (adminTab === "self" && credentialPage > selfTotalPages) {
      setCredentialPage(selfTotalPages);
    }
  }, [adminTab, credentialPage, selfTotalPages, setCredentialPage]);

  useEffect(() => {
    if (String(adminTab).startsWith("shared:") && credentialPage > sharedTotalPages) {
      setCredentialPage(sharedTotalPages);
    }
  }, [adminTab, credentialPage, sharedTotalPages, setCredentialPage]);

  const togglePasswordVisibility = (rowId) => {
    const currentTs = Date.now();
    setPasswordVisibleUntil((prev) => {
      const visible = Number(prev[rowId] || 0) > currentTs;
      return { ...prev, [rowId]: visible ? 0 : currentTs + PASSWORD_VISIBLE_MS };
    });
  };

  const isPasswordVisible = (rowId) => Number(passwordVisibleUntil[rowId] || 0) > nowTs;

  const copyText = async (value, label) => {
    try {
      if (!value) throw new Error("empty");
      await navigator.clipboard.writeText(String(value));
      window.alert(`${label} скопирован`);
    } catch {
      window.alert("Не удалось скопировать");
    }
  };

  const handleReject = (requestId) => {
    const reason = String(reviewComments[requestId] || "").trim();
    if (!reason) {
      window.alert("Укажите причину отклонения.");
      return;
    }
    onRejectAccessRequest(requestId);
  };

  const openFloatingMenu = (event, type, payload, width = 210) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      top: rect.bottom + 6,
      left: Math.min(rect.right - width, window.innerWidth - width - 8)
    };

    if (type === "credential") {
      setOpenUserMenu(null);
      setOpenCredentialMenu((prev) => (prev?.id === payload.id ? null : { ...position, ...payload }));
      return;
    }

    setOpenCredentialMenu(null);
    setOpenUserMenu((prev) => (prev?.id === payload.id ? null : { ...position, ...payload }));
  };

  return (
    <section className="admin-layout">
      <div className="admin-sidebar-stack">
        <aside className="admin-sidebar admin-sidebar-secondary">
          <h3>Профиль</h3>
          <p className="sidebar-profile-name">{viewerFullName || "Без ФИО"}</p>
          <p className="hint">Роль: {roleLabel}</p>
          <p className="hint">Отдел: {viewerDepartment}</p>
        </aside>

        <aside className="admin-sidebar">
          <h2>Панель руководителя</h2>
          <nav>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sidebar-link ${adminTab === tab.id ? "is-active" : ""}`}
                onClick={() => {
                  setCredentialPage(1);
                  onAdminTabChange(tab.id);
                }}
              >
                <span>{tab.label}</span>
                {Number(tab.badge || 0) > 0 && <span className="sidebar-badge">{tab.badge}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {isDepartmentHead && !isSuperuser && (
          <aside className="admin-sidebar admin-sidebar-secondary">
            <h3>Мои доступы</h3>
            <p className="hint">Только ваши данные</p>
            <button
              type="button"
              className={`sidebar-link ${adminTab === "self" ? "is-active" : ""}`}
              onClick={() => {
                setCredentialPage(1);
                onAdminTabChange("self");
              }}
            >
              <span>Открыть</span>
              <span className="sidebar-badge">{selfCredentials.length}</span>
            </button>
          </aside>
        )}

        {isDepartmentHead &&
          !isSuperuser &&
          receivedDepartmentShares.map((share) => {
            const shareTabId = `shared:${share.id}`;
            const grantorLabel =
              share.grantor?.full_name || share.grantor?.portal_login || "руководителя";
            const departmentName = share.department?.name || "без названия";
            const sharedCount = (adminCredentials || []).filter(
              (credential) =>
                Number(credential.user?.department?.id || 0) === Number(share.department?.id || 0)
            ).length;

            return (
              <aside key={share.id} className="admin-sidebar admin-sidebar-secondary">
                <h3>{`Отдел ${grantorLabel}`}</h3>
                <p className="hint">Только отдел: {departmentName}</p>
                <button
                  type="button"
                  className={`sidebar-link ${adminTab === shareTabId ? "is-active" : ""}`}
                  onClick={() => {
                    setCredentialPage(1);
                    onAdminTabChange(shareTabId);
                  }}
                >
                  <span>Открыть</span>
                  <span className="sidebar-badge">{sharedCount}</span>
                </button>
              </aside>
            );
          })}
      </div>

      <main className="admin-content">
        {adminTab === "department" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Мой отдел</h2>
                <p>Управление сотрудниками отдела и их доступами к сервисам.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setShowCredentialCreate(true)}>
                Добавить доступ
              </button>
            </div>

            {adminStatus.error && <div className="inline-error">{adminStatus.error}</div>}
            {adminStatus.success && <div className="inline-success">{adminStatus.success}</div>}
            {credentialStatus.error && <div className="inline-error">{credentialStatus.error}</div>}
            {credentialStatus.success && <div className="inline-success">{credentialStatus.success}</div>}

            <div className="credentials-layout">
              <aside className="credentials-users">
                <div className="credentials-users-header">
                  <h3>Сотрудники</h3>
                  <button
                    className="icon-button"
                    type="button"
                    title="Добавить сотрудника"
                    aria-label="Добавить сотрудника"
                    onClick={() => setShowUserCreate(true)}
                  >
                    +
                  </button>
                </div>

                <input
                  type="search"
                  placeholder="Поиск сотрудника"
                  value={usersQuery}
                  onChange={(event) => setUsersQuery(event.target.value)}
                />

                {credentialUsers.length === 0 ? (
                  <div className="hint" style={{ marginTop: 10 }}>Нет сотрудников</div>
                ) : (
                  <div className="credentials-user-list" style={{ marginTop: 10 }}>
                    {credentialUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`credential-user-item ${
                          String(user.id) === String(selectedCredentialUserId) ? "is-active" : ""
                        }`}
                      >
                        <button
                          className="credential-user-select"
                          type="button"
                          onClick={() => {
                            setSelectedCredentialUserId(String(user.id));
                            setCredentialPage(1);
                          }}
                        >
                          <strong>{user.full_name || user.portal_login}</strong>
                          <span>{user.portal_login}</span>
                          <span className="hint">Доступов: {user.credentials_count}</span>
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          title="Действия"
                          aria-label="Действия"
                          onClick={(event) =>
                            openFloatingMenu(event, "user", { id: user.id, user }, 220)
                          }
                        >
                          ⋯
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </aside>

              <div className="credentials-main">
                <div className="toolbar-row">
                  <input
                    type="search"
                    placeholder="Поиск по сервису или логину"
                    value={credentialQuery}
                    onChange={(event) => {
                      setCredentialQuery(event.target.value);
                      setCredentialPage(1);
                    }}
                  />
                  <select value={filters.credentialService} onChange={onFilterChange("credentialService")}> 
                    <option value="all">Все сервисы</option>
                    {adminServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hint" style={{ marginBottom: 10 }}>
                  {selectedCredentialUser
                    ? `Выбран: ${selectedCredentialUser.full_name || selectedCredentialUser.portal_login}`
                    : "Выберите сотрудника слева"}
                </div>

                {pagedCredentialsForSelectedUser.length === 0 ? (
                  <div className="empty-state">Нет доступов. Нажмите «Добавить доступ».</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table table-credentials">
                      <thead>
                        <tr>
                          <th>Сервис</th>
                          <th>Логин</th>
                          <th>Пароль / Ключ</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedCredentialsForSelectedUser.map((credential) => (
                          <tr key={credential.id}>
                            <td>{credential.service?.name || "Сервис"}</td>
                            <td>
                              {editCredentialId === credential.id ? (
                                editCredentialForm.secret_type === "password" ? (
                                  <input
                                    type="text"
                                    value={editCredentialForm.login}
                                    onChange={onEditCredentialChange("login")}
                                    placeholder="Логин"
                                  />
                                ) : (
                                  <span className="hint">Для этого типа логин не используется</span>
                                )
                              ) : credential.secret_type === "ssh_key" ||
                                credential.secret_type === "api_token" ? (
                                "—"
                              ) : (
                                <button
                                  className="cell-link"
                                  type="button"
                                  onClick={() => copyText(credential.login, "Логин")}
                                  title="Нажмите, чтобы скопировать логин"
                                >
                                  {credential.login}
                                </button>
                              )}
                            </td>
                            <td>
                              {editCredentialId === credential.id ? (
                                <div className="password-cell">
                                  {editCredentialForm.secret_type === "ssh_key" ? (
                                    <textarea
                                      value={editCredentialForm.password}
                                      onChange={onEditCredentialChange("password")}
                                    />
                                  ) : (
                                    <input
                                      type={isPasswordVisible(credential.id) ? "text" : "password"}
                                      value={editCredentialForm.password}
                                      onChange={onEditCredentialChange("password")}
                                    />
                                  )}
                                  <button
                                    className="icon-button"
                                    type="button"
                                    onClick={() => togglePasswordVisibility(credential.id)}
                                    aria-label={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                                    title={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        d="M12 5C6 5 2.2 9.4 1 12c1.2 2.6 5 7 11 7s9.8-4.4 11-7c-1.2-2.6-5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="password-cell">
                                  <button
                                    className="icon-button"
                                    type="button"
                                    onClick={() => togglePasswordVisibility(credential.id)}
                                    aria-label={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                                    title={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        d="M12 5C6 5 2.2 9.4 1 12c1.2 2.6 5 7 11 7s9.8-4.4 11-7c-1.2-2.6-5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                  {isPasswordVisible(credential.id) ? (
                                    <button
                                      className="cell-link secret-preview"
                                      type="button"
                                      onClick={() => copyText(credential.password, "Секрет")}
                                      title="Нажмите, чтобы скопировать"
                                    >
                                      {getSecretPreview(credential.password)}
                                    </button>
                                  ) : (
                                    <span>••••••••</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>
                              {editCredentialId === credential.id ? (
                                <div className="row-actions">
                                  <button
                                    className="btn btn-primary btn-sm"
                                    type="button"
                                    onClick={() => onSaveCredential(credential)}
                                  >
                                    Сохранить
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={onCancelEditCredential}
                                  >
                                    Отмена
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="icon-button"
                                  title="Действия"
                                  aria-label="Действия"
                                  type="button"
                                  onClick={(event) =>
                                    openFloatingMenu(event, "credential", { id: credential.id, credential }, 220)
                                  }
                                >
                                  ⋯
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="pagination-row">
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    disabled={credentialPage === 1}
                    onClick={() => setCredentialPage((prev) => Math.max(1, prev - 1))}
                  >
                    Назад
                  </button>
                  <span>
                    {credentialPage} / {selectedCredentialTotalPages}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    disabled={credentialPage === selectedCredentialTotalPages}
                    onClick={() => setCredentialPage((prev) => Math.min(selectedCredentialTotalPages, prev + 1))}
                  >
                    Вперед
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {adminTab === "shares" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Доступ отдела</h2>
                <p>Только просмотр другого отдела: без редактирования, удаления и выдачи прав.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setShowShareCreate(true)}>
                Выдать доступ
              </button>
            </div>

            {shareStatus.error && <div className="inline-error">{shareStatus.error}</div>}
            {shareStatus.success && <div className="inline-success">{shareStatus.success}</div>}

            <div className="toolbar-row">
              <input
                type="search"
                placeholder="Поиск по отделу и руководителю"
                value={sharesQuery}
                onChange={(event) => setSharesQuery(event.target.value)}
              />
            </div>

            {filteredShares.length === 0 ? (
              <div className="empty-state">
                <p>Нет выданных доступов к отделам.</p>
                <p className="hint">Здесь отображаются доступы к другим отделам только для просмотра.</p>
                <p className="hint">
                  Например: маркетинг может получить просмотр IT-доступов без права редактирования.
                </p>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowShareCreate(true)}>
                  Выдать доступ
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Отдел</th>
                      <th>Кто выдал</th>
                      <th>Кому выдано</th>
                      <th>Срок действия</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShares.map((share) => (
                      <tr key={share.id}>
                        <td>{share.department?.name || "Без отдела"}</td>
                        <td>{share.grantor?.portal_login || "—"}</td>
                        <td>{share.grantee?.portal_login || "—"}</td>
                        <td>{formatDateTime(share.expires_at)}</td>
                        <td>{share.is_active ? "активен" : "выключен"}</td>
                        <td>
                          {canRevokeShare(share) ? (
                            <button className="btn btn-danger btn-sm" type="button" onClick={() => onDeleteShare(share)}>
                              Отозвать
                            </button>
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {adminTab === "requests" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Заявки</h2>
                <p>Обработка запросов сотрудников на доступ к сервисам.</p>
              </div>
            </div>

            {accessRequestStatus.error && <div className="inline-error">{accessRequestStatus.error}</div>}
            {accessRequestStatus.success && <div className="inline-success">{accessRequestStatus.success}</div>}

            <div className="toolbar-row">
              <select value={reviewRequestFilters.status} onChange={onReviewRequestFilterChange("status")}>
                <option value="all">Все статусы</option>
                <option value="pending">На рассмотрении</option>
                <option value="approved">Одобрен</option>
                <option value="rejected">Отклонен</option>
                <option value="canceled">Отменен</option>
              </select>
              <select value={reviewRequestFilters.service} onChange={onReviewRequestFilterChange("service")}>
                <option value="all">Все сервисы</option>
                {reviewRequestServiceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Поиск"
                value={reviewRequestFilters.query}
                onChange={onReviewRequestFilterChange("query")}
              />
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={onExportAccessRequestsCsv}
                title="Экспорт CSV"
                disabled={accessRequests.length === 0}
              >
                CSV
              </button>
            </div>

            {accessRequests.length === 0 ? (
              <div className="empty-state">Нет заявок. Новые заявки появятся здесь.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Сотрудник</th>
                      <th>Сервис</th>
                      <th>Комментарий</th>
                      <th>Дата</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessRequests.map((item) => (
                      <tr key={item.id}>
                        <td>{item.requester?.portal_login || "Сотрудник"}</td>
                        <td>{item.service?.name || "Сервис"}</td>
                        <td>{item.justification || "—"}</td>
                        <td>{formatDateTime(item.requested_at)}</td>
                        <td>
                          <span className={getRequestBadgeClass(item.status)}>
                            <span>{getRequestBadgeIcon(item.status)}</span>
                            {requestStatusLabel[item.status] || item.status}
                          </span>
                        </td>
                        <td>
                          {item.status === "pending" ? (
                            <div className="row-actions">
                              <input
                                className="compact-input"
                                type="text"
                                value={reviewComments[item.id] || ""}
                                placeholder="Причина отклонения (обязательно)"
                                onChange={onReviewCommentChange(item.id)}
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                type="button"
                                onClick={() => onApproveAccessRequest(item.id)}
                              >
                                Одобрить
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                type="button"
                                onClick={() => handleReject(item.id)}
                              >
                                Отклонить
                              </button>
                            </div>
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="hint">
              Показано {accessRequests.length} из {accessRequestsTotal}
            </div>
          </section>
        )}

        {adminTab === "self" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Мои доступы</h2>
                <p>Только ваши учетные данные. Доступы сотрудников здесь не отображаются.</p>
              </div>
            </div>

            <div className="toolbar-row">
              <input
                type="search"
                placeholder="Поиск по сервису или логину"
                value={selfQuery}
                onChange={(event) => {
                  setSelfQuery(event.target.value);
                  setCredentialPage(1);
                }}
              />
              <select value={filters.credentialService} onChange={onFilterChange("credentialService")}>
                <option value="all">Все сервисы</option>
                {adminServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            {selfPageRows.length === 0 ? (
              <div className="empty-state">У вас пока нет назначенных доступов.</div>
            ) : (
              <div className="table-wrap">
                <table className="table table-credentials">
                  <thead>
                    <tr>
                      <th>Сервис</th>
                      <th>Логин</th>
                      <th>Пароль / Ключ</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selfPageRows.map((credential) => (
                      <tr key={credential.id}>
                        <td>{credential.service?.name || "Сервис"}</td>
                        <td>
                          {credential.secret_type === "ssh_key" || credential.secret_type === "api_token" ? (
                            "—"
                          ) : (
                            <button
                              className="cell-link"
                              type="button"
                              onClick={() => copyText(credential.login, "Логин")}
                              title="Нажмите, чтобы скопировать логин"
                            >
                              {credential.login}
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="password-cell">
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() => togglePasswordVisibility(credential.id)}
                              aria-label={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                              title={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 5C6 5 2.2 9.4 1 12c1.2 2.6 5 7 11 7s9.8-4.4 11-7c-1.2-2.6-5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                            {isPasswordVisible(credential.id) ? (
                              <button
                                className="cell-link secret-preview"
                                type="button"
                                onClick={() => copyText(credential.password, "Секрет")}
                              >
                                {getSecretPreview(credential.password)}
                              </button>
                            ) : (
                              <span>••••••••</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            title="Действия"
                            aria-label="Действия"
                            type="button"
                            onClick={(event) =>
                              openFloatingMenu(event, "credential", { id: credential.id, credential }, 220)
                            }
                          >
                            ⋯
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pagination-row">
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={credentialPage === 1}
                onClick={() => setCredentialPage((prev) => Math.max(1, prev - 1))}
              >
                Назад
              </button>
              <span>
                {credentialPage} / {selfTotalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={credentialPage === selfTotalPages}
                onClick={() => setCredentialPage((prev) => Math.min(selfTotalPages, prev + 1))}
              >
                Вперед
              </button>
            </div>
          </section>
        )}

        {String(adminTab).startsWith("shared:") && selectedSharedDepartment && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>{`Отдел ${
                  selectedSharedDepartment.grantor?.full_name ||
                  selectedSharedDepartment.grantor?.portal_login ||
                  "руководителя"
                }`}</h2>
                <p>
                  Только просмотр отдела: {selectedSharedDepartment.department?.name || "Без отдела"}.
                </p>
              </div>
            </div>

            <div className="toolbar-row">
              <input
                type="search"
                placeholder="Поиск по сервису или логину"
                value={sharedQuery}
                onChange={(event) => {
                  setSharedQuery(event.target.value);
                  setCredentialPage(1);
                }}
              />
              <select value={filters.credentialService} onChange={onFilterChange("credentialService")}>
                <option value="all">Все сервисы</option>
                {adminServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            {sharedPageRows.length === 0 ? (
              <div className="empty-state">По этому отделу пока нет доступов.</div>
            ) : (
              <div className="table-wrap">
                <table className="table table-credentials">
                  <thead>
                    <tr>
                      <th>Сервис</th>
                      <th>Логин</th>
                      <th>Пароль / Ключ</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedPageRows.map((credential) => (
                      <tr key={credential.id}>
                        <td>{credential.service?.name || "Сервис"}</td>
                        <td>
                          {credential.secret_type === "ssh_key" || credential.secret_type === "api_token" ? (
                            "—"
                          ) : (
                            <button
                              className="cell-link"
                              type="button"
                              onClick={() => copyText(credential.login, "Логин")}
                              title="Нажмите, чтобы скопировать логин"
                            >
                              {credential.login}
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="password-cell">
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() => togglePasswordVisibility(credential.id)}
                              aria-label={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                              title={isPasswordVisible(credential.id) ? "Скрыть секрет" : "Показать секрет"}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 5C6 5 2.2 9.4 1 12c1.2 2.6 5 7 11 7s9.8-4.4 11-7c-1.2-2.6-5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                                  fill="currentColor"
                                />
                              </svg>
                            </button>
                            {isPasswordVisible(credential.id) ? (
                              <button
                                className="cell-link secret-preview"
                                type="button"
                                onClick={() => copyText(credential.password, "Секрет")}
                              >
                                {getSecretPreview(credential.password)}
                              </button>
                            ) : (
                              <span>••••••••</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            title="Действия"
                            aria-label="Действия"
                            type="button"
                            onClick={(event) =>
                              openFloatingMenu(event, "credential", { id: credential.id, credential }, 220)
                            }
                          >
                            ⋯
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pagination-row">
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={credentialPage === 1}
                onClick={() => setCredentialPage((prev) => Math.max(1, prev - 1))}
              >
                Назад
              </button>
              <span>
                {credentialPage} / {sharedTotalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={credentialPage === sharedTotalPages}
                onClick={() => setCredentialPage((prev) => Math.min(sharedTotalPages, prev + 1))}
              >
                Вперед
              </button>
            </div>
          </section>
        )}
      </main>

      {credentialDetails && (
        <div className="modal-backdrop" onClick={() => setCredentialDetails(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Подробности доступа</h3>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setCredentialDetails(null)}>
                Закрыть
              </button>
            </div>
            <div className="detail-list">
              <div><strong>Сервис:</strong> {credentialDetails.service?.name || "—"}</div>
              <div><strong>Сотрудник:</strong> {credentialDetails.user?.full_name || credentialDetails.user?.portal_login || "—"}</div>
              <div><strong>Тип:</strong> {getSecretTypeLabel(credentialDetails.secret_type)}</div>
              <div><strong>Статус:</strong> {credentialDetails.is_active ? "Активен" : "Выключен"}</div>
              <div><strong>Обновлено:</strong> {formatDateTime(credentialDetails.updated_at)}</div>
              {credentialDetails.secret_type === "ssh_key" && (
                <>
                  <div><strong>SSH host:</strong> {credentialDetails.ssh_host || "—"}</div>
                  <div><strong>SSH port:</strong> {credentialDetails.ssh_port || "—"}</div>
                  <div><strong>Алгоритм:</strong> {(credentialDetails.ssh_algorithm || "—").toUpperCase()}</div>
                  <div><strong>Fingerprint:</strong> {credentialDetails.ssh_fingerprint || "—"}</div>
                </>
              )}
              <div>
                <strong>{getSecretValueLabel(credentialDetails.secret_type)}:</strong>{" "}
                {isPasswordVisible(credentialDetails.id)
                  ? credentialDetails.password
                  : "••••••••"}
              </div>
              <div><strong>Примечание:</strong> {credentialDetails.notes || "—"}</div>
            </div>
          </div>
        </div>
      )}

      {openCredentialMenu && (
        <div
          className="floating-menu"
          style={{
            top: `${Math.max(8, openCredentialMenu.top)}px`,
            left: `${Math.max(8, openCredentialMenu.left)}px`
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {openCredentialMenu.credential.secret_type === "ssh_key" && (
            <button
              type="button"
              onClick={() => {
                onDownloadCredentialSecret?.(openCredentialMenu.credential.id);
                setOpenCredentialMenu(null);
              }}
            >
              Скачать ключ
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCredentialDetails(openCredentialMenu.credential);
              setOpenCredentialMenu(null);
            }}
          >
            Подробнее
          </button>
          {canWriteForUser(openCredentialMenu.credential.user) && (
            <>
              <button
                type="button"
                onClick={() => {
                  onStartEditCredential(openCredentialMenu.credential);
                  setOpenCredentialMenu(null);
                }}
              >
                Редактировать доступ
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleCredential(openCredentialMenu.credential);
                  setOpenCredentialMenu(null);
                }}
              >
                {openCredentialMenu.credential.is_active ? "Выключить" : "Включить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCredential(openCredentialMenu.credential);
                  setOpenCredentialMenu(null);
                }}
              >
                Удалить доступ
              </button>
            </>
          )}
        </div>
      )}

      {openUserMenu && (
        <div
          className="floating-menu"
          style={{
            top: `${Math.max(8, openUserMenu.top)}px`,
            left: `${Math.max(8, openUserMenu.left)}px`
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onEditUser(openUserMenu.user);
              setOpenUserMenu(null);
            }}
          >
            Редактировать пользователя
          </button>
          <button
            type="button"
            onClick={() => {
              onResetUserAccess(openUserMenu.user);
              setOpenUserMenu(null);
            }}
          >
            Сбросить доступ
          </button>
          <button
            type="button"
            onClick={() => {
              onDeactivateUser(openUserMenu.user);
              setOpenUserMenu(null);
            }}
          >
            {openUserMenu.user.is_active ? "Деактивировать" : "Активировать"}
          </button>
        </div>
      )}

      {showUserCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Добавить пользователя</h3>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowUserCreate(false)}>
                Закрыть
              </button>
            </div>
            <form className="modal-form" onSubmit={onCreateUser}>
              <label>
                ФИО
                <input type="text" value={adminForm.full_name} onChange={onAdminChange("full_name")} />
              </label>
              <label>
                Почта
                <input type="email" value={adminForm.email} onChange={onAdminChange("email")} />
              </label>
              <label>
                Логин
                <div className="row-actions">
                  <input
                    type="text"
                    value={adminForm.portal_login}
                    onChange={onAdminChange("portal_login")}
                    required
                  />
                  <button className="btn btn-secondary btn-sm" type="button" onClick={onGenerateLogin}>
                    Сгенерировать
                  </button>
                </div>
              </label>
              {isSuperuser && (
                <>
                  <label>
                    Отдел
                    <select value={adminForm.department_id} onChange={onAdminChange("department_id")}>
                      <option value="">Выберите отдел</option>
                      {adminDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Роль
                    <select value={adminForm.role} onChange={onAdminChange("role")}>
                      <option value="employee">Сотрудник</option>
                      <option value="head">Руководитель отдела</option>
                    </select>
                  </label>
                </>
              )}
              <button className="btn btn-primary" type="submit" disabled={adminStatus.loading}>
                {adminStatus.loading ? "Сохранение..." : "Создать"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showShareCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Выдать доступ к отделу</h3>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowShareCreate(false)}>
                Закрыть
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={(event) => {
                if (!window.confirm("Выдать доступ только для просмотра?")) {
                  event.preventDefault();
                  return;
                }
                onCreateShare(event);
              }}
            >
              {isSuperuser && (
                <label>
                  Отдел
                  <select value={shareForm.department_id || ""} onChange={onShareChange("department_id")}>
                    <option value="">Выберите отдел</option>
                    {adminDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Руководитель
                <select value={shareForm.grantee_id} onChange={onShareChange("grantee_id")}>
                  <option value="">Выберите руководителя</option>
                  {headCandidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.portal_login} {user.full_name ? `(${user.full_name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Срок действия
                <input type="datetime-local" value={shareForm.expires_at} onChange={onShareChange("expires_at")} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={shareStatus.loading}>
                {shareStatus.loading ? "Сохранение..." : "Выдать"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCredentialCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Добавить доступ</h3>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => setShowCredentialCreate(false)}
              >
                Закрыть
              </button>
            </div>
            <form className="modal-form" onSubmit={onCreateCredential}>
              <label>
                Сотрудник
                <select value={credentialForm.user_id} onChange={onCredentialChange("user_id")}>
                  <option value="">Выберите сотрудника</option>
                  {writableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.portal_login} {user.full_name ? `(${user.full_name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Сервис
                <select value={credentialForm.service_id} onChange={onCredentialChange("service_id")}>
                  <option value="">Выберите сервис</option>
                  {adminServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Тип секрета
                <select value={credentialForm.secret_type} onChange={onCredentialChange("secret_type")}>
                  <option value="password">Обычный пароль</option>
                  <option value="api_token">API токен</option>
                  <option value="ssh_key">SSH ключ</option>
                </select>
              </label>
              {credentialForm.secret_type === "password" && (
                <label>
                  Логин сервиса
                  <input type="text" value={credentialForm.login} onChange={onCredentialChange("login")} />
                </label>
              )}
              {credentialForm.secret_type === "ssh_key" && (
                <>
                  <label>
                    SSH host
                    <input type="text" value={credentialForm.ssh_host} onChange={onCredentialChange("ssh_host")} />
                  </label>
                  <label>
                    SSH port
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={credentialForm.ssh_port}
                      onChange={onCredentialChange("ssh_port")}
                    />
                  </label>
                  <label>
                    Алгоритм
                    <select value={credentialForm.ssh_algorithm || "ed25519"} onChange={onCredentialChange("ssh_algorithm")}>
                      <option value="ed25519">Ed25519</option>
                      <option value="rsa">RSA</option>
                      <option value="ecdsa">ECDSA</option>
                    </select>
                  </label>
                  <label>
                    Публичный ключ (опционально)
                    <textarea value={credentialForm.ssh_public_key} onChange={onCredentialChange("ssh_public_key")} />
                  </label>
                  <label>
                    Приватный ключ
                    <textarea
                      value={credentialForm.password}
                      onChange={onCredentialChange("password")}
                      placeholder="Вставьте приватный SSH ключ (если не загружали файл)"
                    />
                  </label>
                  <label>
                    Fingerprint (опционально)
                    <input
                      type="text"
                      value={credentialForm.ssh_fingerprint}
                      onChange={onCredentialChange("ssh_fingerprint")}
                    />
                  </label>
                  <label>
                    Файл приватного ключа (опционально, вместо вставки)
                    <input type="file" accept=".key,.pem,.txt" onChange={onCredentialFileChange} />
                  </label>
                </>
              )}
              {credentialForm.secret_type !== "ssh_key" && (
                <label>
                  {credentialForm.secret_type === "api_token" ? "API токен" : "Секрет"}
                  <input
                    type="password"
                    value={credentialForm.password}
                    onChange={onCredentialChange("password")}
                  />
                </label>
              )}
              <label>
                Примечание
                <input type="text" value={credentialForm.notes} onChange={onCredentialChange("notes")} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={credentialStatus.loading}>
                {credentialStatus.loading ? "Сохранение..." : "Добавить"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
