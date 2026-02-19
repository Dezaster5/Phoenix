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
  filteredCredentials,
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
  onExportAccessRequestsCsv
}) {
  const tabs = [
    { id: "users", label: "Пользователи" },
    { id: "shares", label: "Read-only" },
    { id: "credentials", label: "Креды" },
    { id: "requests", label: "Заявки" },
    { id: "directory", label: "Список" }
  ];
  const requestStatusLabel = {
    pending: "ожидает",
    approved: "одобрен",
    rejected: "отклонен",
    canceled: "отменен"
  };

  return (
    <section className="admin-panel-shell">
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab ${adminTab === tab.id ? "is-active" : ""}`}
            onClick={() => onAdminTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-panel">
        {adminTab === "users" && (
          <div className="admin-card">
        <div className="admin-header">
          <h2>Панель руководителя</h2>
          <span>Создание сотрудников отдела и выдача логинов</span>
        </div>
        <form className="admin-form" onSubmit={onCreateUser}>
          <label>
            ФИО
            <input
              type="text"
              value={adminForm.full_name}
              onChange={onAdminChange("full_name")}
              placeholder="Например, Иван Иванов"
            />
          </label>
          <label>
            Почта
            <input
              type="email"
              value={adminForm.email}
              onChange={onAdminChange("email")}
              placeholder="name@avatariya.com"
            />
          </label>
          <label>
            Логин Phoenix
            <div className="login-inline">
              <input
                type="text"
                value={adminForm.portal_login}
                onChange={onAdminChange("portal_login")}
                placeholder="например, ivan.ivanov"
                required
              />
              <button className="btn btn-ghost" type="button" onClick={onGenerateLogin}>
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
          {adminStatus.error && <div className="login-error">{adminStatus.error}</div>}
          {adminStatus.success && <div className="admin-success">{adminStatus.success}</div>}
          <button className="btn btn-primary" type="submit" disabled={adminStatus.loading}>
            {adminStatus.loading ? "Сохраняем..." : "Создать пользователя"}
          </button>
        </form>
          </div>
        )}

        {adminTab === "shares" && (
          <div className="admin-card">
        <div className="admin-header">
          <h2>Read-only доступ к отделу</h2>
          <span>Руководитель может выдать просмотр своего отдела другому руководителю</span>
        </div>
        <form className="admin-form" onSubmit={onCreateShare}>
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
            Кому выдать (руководитель)
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
            Срок действия до
            <input
              type="datetime-local"
              value={shareForm.expires_at}
              onChange={onShareChange("expires_at")}
            />
          </label>
          {shareStatus.error && <div className="login-error">{shareStatus.error}</div>}
          {shareStatus.success && <div className="admin-success">{shareStatus.success}</div>}
          <button className="btn btn-primary" type="submit" disabled={shareStatus.loading}>
            {shareStatus.loading ? "Сохраняем..." : "Выдать read-only"}
          </button>
        </form>
        <div className="admin-list">
          {activeShares.map((share) => (
            <div key={share.id} className="admin-user">
              <div>
                <strong>{share.department?.name || "Без отдела"}</strong>
                <span>
                  {share.grantor?.portal_login} {"->"} {share.grantee?.portal_login}
                </span>
                <span>
                  Действует до:{" "}
                  {share.expires_at ? new Date(share.expires_at).toLocaleString("ru-RU") : "-"}
                </span>
              </div>
              <div className="admin-meta">
                <span className={`status-pill ${share.is_active ? "active" : "inactive"}`}>
                  {share.is_active ? "активен" : "выключен"}
                </span>
                {canRevokeShare(share) && (
                  <button className="btn btn-mini danger" type="button" onClick={() => onDeleteShare(share)}>
                    Отозвать
                  </button>
                )}
              </div>
            </div>
          ))}
          {activeShares.length === 0 && (
            <div className="empty-state">Read-only доступы к отделам пока не выданы.</div>
          )}
        </div>
          </div>
        )}

        {adminTab === "credentials" && (
          <div className="admin-card">
        <div className="admin-header">
          <h2>Креды сервисов</h2>
          <span>Логин и пароль для доступа к сервису</span>
        </div>
        <form className="admin-form" onSubmit={onCreateCredential}>
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
            <input
              type="text"
              value={credentialForm.login}
              onChange={onCredentialChange("login")}
              placeholder="login@example.com"
            />
          </label>
          <label>
            Пароль сервиса
            <input
              type="text"
              value={credentialForm.password}
              onChange={onCredentialChange("password")}
              placeholder="пароль от сервиса"
            />
          </label>
          <label>
            Примечание
            <input
              type="text"
              value={credentialForm.notes}
              onChange={onCredentialChange("notes")}
              placeholder="например, доступ только для чтения"
            />
          </label>
          {credentialStatus.error && <div className="login-error">{credentialStatus.error}</div>}
          {credentialStatus.success && <div className="admin-success">{credentialStatus.success}</div>}
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
        <div className="admin-list">
          {pagedCredentials.map((credential) => (
            <div key={credential.id} className="admin-user admin-credential">
              <div>
                <strong>{credential.user?.portal_login}</strong>
                <span>{credential.service?.name}</span>
                <span>Отдел: {credential.user?.department?.name || "Без отдела"}</span>
              </div>
              {editCredentialId === credential.id && canWriteForUser(credential.user) ? (
                <div className="admin-edit">
                  <input
                    type="text"
                    value={editCredentialForm.login}
                    onChange={onEditCredentialChange("login")}
                    placeholder="Логин сервиса"
                  />
                  <input
                    type="text"
                    value={editCredentialForm.password}
                    onChange={onEditCredentialChange("password")}
                    placeholder="Пароль сервиса"
                  />
                  <input
                    type="text"
                    value={editCredentialForm.notes}
                    onChange={onEditCredentialChange("notes")}
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
                {canWriteForUser(credential.user) && editCredentialId === credential.id ? (
                  <>
                    <button className="btn btn-mini" type="button" onClick={() => onSaveCredential(credential)}>
                      Сохранить
                    </button>
                    <button className="btn btn-mini danger" type="button" onClick={onCancelEditCredential}>
                      Отмена
                    </button>
                  </>
                ) : canWriteForUser(credential.user) ? (
                  <>
                    <button className="btn btn-mini" type="button" onClick={() => onStartEditCredential(credential)}>
                      Изменить
                    </button>
                    <button className="btn btn-mini" type="button" onClick={() => onToggleCredential(credential)}>
                      {credential.is_active ? "Выключить" : "Включить"}
                    </button>
                    <button className="btn btn-mini danger" type="button" onClick={() => onDeleteCredential(credential)}>
                      Удалить
                    </button>
                  </>
                ) : (
                  <span className="status-pill inactive">read-only</span>
                )}
              </div>
            </div>
          ))}
          {filteredCredentials.length === 0 && <div className="empty-state">Креды ещё не добавлены.</div>}
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
            onClick={() => setCredentialPage((prev) => Math.min(credentialTotalPages, prev + 1))}
          >
            Вперёд
          </button>
        </div>
          </div>
        )}

        {adminTab === "directory" && (
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
                  <span>Отдел: {user.department?.name || "Без отдела"}</span>
                </div>
                <div className="admin-meta">
                  <span className="role-pill">
                    {user.is_superuser
                      ? "супер-админ"
                      : isHeadRole(user.role)
                        ? "руководитель отдела"
                        : "сотрудник"}
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
        )}

        {adminTab === "requests" && (
          <div className="admin-card">
            <div className="admin-header">
              <h2>Заявки на доступ</h2>
              <span>Подтверждение или отклонение запросов сотрудников</span>
            </div>
            {accessRequestStatus.error && <div className="login-error">{accessRequestStatus.error}</div>}
            {accessRequestStatus.success && <div className="admin-success">{accessRequestStatus.success}</div>}
            <div className="request-history-toolbar">
              <div className="request-history-filters">
                <select
                  value={reviewRequestFilters.status}
                  onChange={onReviewRequestFilterChange("status")}
                >
                  <option value="all">Все статусы</option>
                  <option value="pending">Ожидает</option>
                  <option value="approved">Одобрен</option>
                  <option value="rejected">Отклонен</option>
                  <option value="canceled">Отменен</option>
                </select>
                <select
                  value={reviewRequestFilters.service}
                  onChange={onReviewRequestFilterChange("service")}
                >
                  <option value="all">Все сервисы</option>
                  {reviewRequestServiceOptions.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  placeholder="Поиск по сотруднику, сервису, комментарию"
                  value={reviewRequestFilters.query}
                  onChange={onReviewRequestFilterChange("query")}
                />
              </div>
              <button
                className="btn btn-mini"
                type="button"
                onClick={onExportAccessRequestsCsv}
                disabled={accessRequests.length === 0}
              >
                CSV ({accessRequests.length}/{accessRequestsTotal})
              </button>
            </div>
            <div className="admin-list">
              {accessRequests.length === 0 ? (
                <div className="empty-state">Заявок пока нет.</div>
              ) : (
                accessRequests.map((item) => (
                  <div key={item.id} className="admin-user">
                    <div>
                      <strong>{item.requester?.portal_login || "Сотрудник"}</strong>
                      <span>{item.service?.name || "Сервис"}</span>
                      <span>{item.justification || "Без комментария"}</span>
                      <span>
                        Запрошено:{" "}
                        {item.requested_at ? new Date(item.requested_at).toLocaleString("ru-RU") : "-"}
                      </span>
                      {item.reviewed_at && (
                        <span>
                          Рассмотрено: {new Date(item.reviewed_at).toLocaleString("ru-RU")}
                        </span>
                      )}
                      {item.reviewer?.portal_login && <span>Ревьюер: {item.reviewer.portal_login}</span>}
                    </div>
                    <div className="admin-meta">
                      <span className={`status-pill ${item.status || "pending"}`}>
                        {requestStatusLabel[item.status] || item.status || "pending"}
                      </span>
                      {item.status === "pending" && (
                        <>
                          <input
                            className="request-review-input"
                            type="text"
                            value={reviewComments[item.id] || ""}
                            placeholder="Комментарий (опционально)"
                            onChange={onReviewCommentChange(item.id)}
                            disabled={accessRequestStatus.loading}
                          />
                          <button
                            className="btn btn-mini"
                            type="button"
                            disabled={accessRequestStatus.loading}
                            onClick={() => onApproveAccessRequest(item.id)}
                          >
                            Одобрить
                          </button>
                          <button
                            className="btn btn-mini danger"
                            type="button"
                            disabled={accessRequestStatus.loading}
                            onClick={() => onRejectAccessRequest(item.id)}
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
