import { useEffect, useMemo, useState } from "react";

const PASSWORD_VISIBLE_MS = 10000;

const formatDateTime = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("ru-RU");
};

const getRoleLabel = (user, isHeadRole) => {
  if (user?.is_superuser) return "Супер-админ";
  return isHeadRole(user?.role) ? "Руководитель отдела" : "Сотрудник";
};

export default function AdminPanel({
  isSuperuser,
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
  credentialStatus,
  onCreateCredential,
  pagedCredentials,
  editCredentialId,
  editCredentialForm,
  onEditCredentialChange,
  onSaveCredential,
  onCancelEditCredential,
  onStartEditCredential,
  onToggleCredential,
  onDeleteCredential,
  credentialPage,
  credentialTotalPages,
  setCredentialPage,
  adminUsers,
  isHeadRole,
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
  adminCredentials
}) {
  const [showUserCreate, setShowUserCreate] = useState(false);
  const [showShareCreate, setShowShareCreate] = useState(false);
  const [showCredentialCreate, setShowCredentialCreate] = useState(false);
  const [usersQuery, setUsersQuery] = useState("");
  const [sharesQuery, setSharesQuery] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [passwordVisibleUntil, setPasswordVisibleUntil] = useState({});

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (adminStatus.success) setShowUserCreate(false);
  }, [adminStatus.success]);

  useEffect(() => {
    if (shareStatus.success) setShowShareCreate(false);
  }, [shareStatus.success]);

  useEffect(() => {
    if (credentialStatus.success) setShowCredentialCreate(false);
  }, [credentialStatus.success]);

  const tabs = [
    { id: "users", label: "Пользователи" },
    { id: "shares", label: "Доступ отдела" },
    { id: "credentials", label: "Креды" },
    { id: "requests", label: "Заявки" },
    { id: "directory", label: "Все доступы" }
  ];

  const requestStatusLabel = {
    pending: "ожидает",
    approved: "одобрен",
    rejected: "отклонен",
    canceled: "отменен"
  };

  const filteredUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((user) =>
      [
        user.portal_login,
        user.full_name,
        user.email,
        user.department?.name,
        getRoleLabel(user, isHeadRole)
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [adminUsers, isHeadRole, usersQuery]);

  const filteredShares = useMemo(() => {
    const q = sharesQuery.trim().toLowerCase();
    if (!q) return activeShares;
    return activeShares.filter((share) =>
      [share.department?.name, share.grantor?.portal_login, share.grantee?.portal_login]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [activeShares, sharesQuery]);

  const directoryRows = useMemo(() => {
    const q = directoryQuery.trim().toLowerCase();
    const rows = (adminCredentials || []).map((item) => ({
      id: item.id,
      service: item.service?.name || "Сервис",
      user: item.user?.portal_login || "Сотрудник",
      department: item.user?.department?.name || "Без отдела",
      login: item.login || "—",
      status: item.is_active ? "активен" : "выключен",
      updatedAt: item.updated_at
    }));
    if (!q) return rows;
    return rows.filter((row) =>
      [row.service, row.user, row.department, row.login, row.status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [adminCredentials, directoryQuery]);

  const showPasswordForTenSeconds = (rowId) => {
    setPasswordVisibleUntil((prev) => ({ ...prev, [rowId]: Date.now() + PASSWORD_VISIBLE_MS }));
  };

  const isPasswordVisible = (rowId) => Number(passwordVisibleUntil[rowId] || 0) > nowTs;

  const remainingSeconds = (rowId) =>
    Math.max(0, Math.ceil((Number(passwordVisibleUntil[rowId] || 0) - nowTs) / 1000));

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
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

  return (
    <section className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Панель руководителя</h2>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`sidebar-link ${adminTab === tab.id ? "is-active" : ""}`}
              onClick={() => onAdminTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="admin-content">
        {adminTab === "users" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Пользователи</h2>
                <p>Управление сотрудниками отдела и их доступом в систему.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setShowUserCreate(true)}>
                Добавить пользователя
              </button>
            </div>

            {adminStatus.error && <div className="inline-error">{adminStatus.error}</div>}
            {adminStatus.success && <div className="inline-success">{adminStatus.success}</div>}

            <div className="toolbar-row">
              <input
                type="search"
                placeholder="Поиск по ФИО, логину, отделу"
                value={usersQuery}
                onChange={(event) => setUsersQuery(event.target.value)}
              />
            </div>

            {filteredUsers.length === 0 ? (
              <div className="empty-state">Нет пользователей. Нажмите «Добавить пользователя».</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ФИО / Логин</th>
                      <th>Отдел</th>
                      <th>Роль</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div>{user.full_name || "Без имени"}</div>
                          <div className="hint">{user.portal_login}</div>
                        </td>
                        <td>{user.department?.name || "Без отдела"}</td>
                        <td>{getRoleLabel(user, isHeadRole)}</td>
                        <td>{user.is_active ? "активен" : "неактивен"}</td>
                        <td>
                          {!user.is_superuser ? (
                            <div className="row-actions">
                              <button className="btn btn-secondary btn-sm" type="button" onClick={() => onEditUser(user)}>
                                Редактировать
                              </button>
                              <button className="btn btn-secondary btn-sm" type="button" onClick={() => onResetUserAccess(user)}>
                                Сбросить доступ
                              </button>
                              {user.is_active && (
                                <button className="btn btn-danger btn-sm" type="button" onClick={() => onDeactivateUser(user)}>
                                  Деактивировать
                                </button>
                              )}
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
          </section>
        )}

        {adminTab === "shares" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Доступ отдела</h2>
                <p>
                  Дает только просмотр другого отдела: без редактирования, удаления и выдачи прав.
                </p>
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
              <div className="empty-state">Нет выданных доступов к отделам.</div>
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

        {adminTab === "credentials" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Креды</h2>
                <p>Логины и пароли для сервисов сотрудников отдела.</p>
              </div>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setShowCredentialCreate(true)}
              >
                Добавить креды
              </button>
            </div>

            {credentialStatus.error && <div className="inline-error">{credentialStatus.error}</div>}
            {credentialStatus.success && <div className="inline-success">{credentialStatus.success}</div>}

            <div className="toolbar-row">
              <select value={filters.credentialUser} onChange={onFilterChange("credentialUser")}>
                <option value="all">Все сотрудники</option>
                {writableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.portal_login}
                  </option>
                ))}
              </select>
              <select value={filters.credentialService} onChange={onFilterChange("credentialService")}>
                <option value="all">Все сервисы</option>
                {adminServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            {pagedCredentials.length === 0 ? (
              <div className="empty-state">Нет кредов. Нажмите «Добавить креды».</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Сервис</th>
                      <th>Кому назначено</th>
                      <th>Логин</th>
                      <th>Пароль</th>
                      <th>Примечание</th>
                      <th>Обновлено</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCredentials.map((credential) => (
                      <tr key={credential.id}>
                        <td>{credential.service?.name || "Сервис"}</td>
                        <td>
                          <div>{credential.user?.portal_login || "Сотрудник"}</div>
                          <div className="hint">{credential.user?.department?.name || "Без отдела"}</div>
                        </td>
                        <td>
                          {editCredentialId === credential.id ? (
                            <input
                              type="text"
                              value={editCredentialForm.login}
                              onChange={onEditCredentialChange("login")}
                            />
                          ) : (
                            credential.login
                          )}
                        </td>
                        <td>
                          {editCredentialId === credential.id ? (
                            <input
                              type="text"
                              value={editCredentialForm.password}
                              onChange={onEditCredentialChange("password")}
                            />
                          ) : isPasswordVisible(credential.id) ? (
                            credential.password
                          ) : (
                            "••••••••"
                          )}
                        </td>
                        <td>
                          {editCredentialId === credential.id ? (
                            <input
                              type="text"
                              value={editCredentialForm.notes}
                              onChange={onEditCredentialChange("notes")}
                            />
                          ) : (
                            credential.notes || "—"
                          )}
                        </td>
                        <td>{formatDateTime(credential.updated_at)}</td>
                        <td>
                          {canWriteForUser(credential.user) ? (
                            <div className="row-actions">
                              {editCredentialId === credential.id ? (
                                <>
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
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => copyText(credential.login, "Логин")}
                                  >
                                    Копировать логин
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => showPasswordForTenSeconds(credential.id)}
                                  >
                                    Показать 10 сек
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => {
                                      if (!isPasswordVisible(credential.id)) {
                                        window.alert("Сначала нажмите «Показать 10 сек».");
                                        return;
                                      }
                                      copyText(credential.password, "Пароль");
                                    }}
                                  >
                                    Копировать пароль
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => onStartEditCredential(credential)}
                                  >
                                    Редактировать
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => onToggleCredential(credential)}
                                  >
                                    {credential.is_active ? "Выключить" : "Включить"}
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    type="button"
                                    onClick={() => onDeleteCredential(credential)}
                                  >
                                    Удалить
                                  </button>
                                </>
                              )}
                              {isPasswordVisible(credential.id) && (
                                <span className="hint">скрытие через {remainingSeconds(credential.id)}с</span>
                              )}
                            </div>
                          ) : (
                            <span className="hint">только просмотр</span>
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
                {credentialPage} / {credentialTotalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={credentialPage === credentialTotalPages}
                onClick={() => setCredentialPage((prev) => Math.min(credentialTotalPages, prev + 1))}
              >
                Вперед
              </button>
            </div>
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
                <option value="pending">Ожидает</option>
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
                        <td>{requestStatusLabel[item.status] || item.status}</td>
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

        {adminTab === "directory" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Все доступы отдела</h2>
                <p>Сводный просмотр сервисов, логинов и текущих статусов.</p>
              </div>
            </div>

            <div className="toolbar-row">
              <input
                type="search"
                placeholder="Поиск по сервису, сотруднику или логину"
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
              />
            </div>

            {directoryRows.length === 0 ? (
              <div className="empty-state">Нет данных для отображения.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Сервис</th>
                      <th>Сотрудник</th>
                      <th>Отдел</th>
                      <th>Логин</th>
                      <th>Статус</th>
                      <th>Обновлено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directoryRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.service}</td>
                        <td>{row.user}</td>
                        <td>{row.department}</td>
                        <td>{row.login}</td>
                        <td>{row.status}</td>
                        <td>{formatDateTime(row.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

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
              <h3>Добавить креды</h3>
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
                Логин сервиса
                <input type="text" value={credentialForm.login} onChange={onCredentialChange("login")} />
              </label>
              <label>
                Пароль сервиса
                <input type="text" value={credentialForm.password} onChange={onCredentialChange("password")} />
              </label>
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
