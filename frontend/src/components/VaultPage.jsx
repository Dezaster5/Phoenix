export default function VaultPage({
  totalServices,
  serviceGroupsCount,
  search,
  onSearchChange,
  serviceFilter,
  onServiceFilterChange,
  serviceOptions,
  departmentOptions,
  departmentFilter,
  onDepartmentFilterChange,
  ownerOptions,
  ownerFilter,
  onOwnerFilterChange,
  filteredSections,
  accentClass,
  revealed,
  onToggleReveal,
  onCopyField,
  requestableServices,
  accessRequestForm,
  onAccessRequestChange,
  onCreateAccessRequest,
  accessRequestStatus,
  ownAccessRequests,
  ownAccessRequestsTotal,
  ownRequestFilters,
  ownRequestServiceOptions,
  onOwnRequestFilterChange,
  onExportOwnRequestsCsv,
  onCancelAccessRequest
}) {
  const requestStatusLabel = {
    pending: "ожидает",
    approved: "одобрен",
    rejected: "отклонен",
    canceled: "отменен"
  };

  return (
    <>
      <section className="toolbar">
        <div className="toolbar-left">
          <h2>Мои сервисы</h2>
          <span className="subtitle">
            Учёток: {totalServices} | Сервисов: {serviceGroupsCount}
          </span>
        </div>
        <div className="toolbar-right">
          <div className="search">
            <input
              type="search"
              placeholder="Поиск по сервису, логину или ссылке"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <span className="search-icon">⌕</span>
          </div>
          <div className="view-filters">
            <select value={serviceFilter} onChange={(event) => onServiceFilterChange(event.target.value)}>
              <option value="all">Все сервисы</option>
              {serviceOptions.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            {departmentOptions.length > 1 && (
              <select
                value={departmentFilter}
                onChange={(event) => onDepartmentFilterChange(event.target.value)}
              >
                <option value="all">Все отделы</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            )}
            {ownerOptions.length > 1 && (
              <select value={ownerFilter} onChange={(event) => onOwnerFilterChange(event.target.value)}>
                <option value="all">Все сотрудники</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.value} value={owner.value}>
                    {owner.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      <section className="request-strip">
        <div className="request-panel">
          <h3>Запрос доступа к сервису</h3>
          <form className="request-form" onSubmit={onCreateAccessRequest}>
            <select value={accessRequestForm.service_id} onChange={onAccessRequestChange("service_id")}>
              <option value="">Выберите сервис</option>
              {requestableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Причина запроса (необязательно)"
              value={accessRequestForm.justification}
              onChange={onAccessRequestChange("justification")}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={accessRequestStatus.loading || !accessRequestForm.service_id}
            >
              {accessRequestStatus.loading ? "Отправляем..." : "Отправить запрос"}
            </button>
          </form>
          {accessRequestStatus.error && <div className="login-error">{accessRequestStatus.error}</div>}
          {accessRequestStatus.success && <div className="admin-success">{accessRequestStatus.success}</div>}
        </div>

        <div className="request-panel">
          <h3>Мои запросы</h3>
          <div className="request-history-toolbar">
            <div className="request-history-filters">
              <select value={ownRequestFilters.status} onChange={onOwnRequestFilterChange("status")}>
                <option value="all">Все статусы</option>
                <option value="pending">Ожидает</option>
                <option value="approved">Одобрен</option>
                <option value="rejected">Отклонен</option>
                <option value="canceled">Отменен</option>
              </select>
              <select value={ownRequestFilters.service} onChange={onOwnRequestFilterChange("service")}>
                <option value="all">Все сервисы</option>
                {ownRequestServiceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Поиск по сервису или комментарию"
                value={ownRequestFilters.query}
                onChange={onOwnRequestFilterChange("query")}
              />
            </div>
            <button
              className="btn btn-mini"
              type="button"
              onClick={onExportOwnRequestsCsv}
              disabled={ownAccessRequests.length === 0}
            >
              CSV ({ownAccessRequests.length}/{ownAccessRequestsTotal})
            </button>
          </div>
          <div className="request-list">
            {ownAccessRequests.length === 0 ? (
              <div className="request-item-empty">Заявок пока нет.</div>
            ) : (
              ownAccessRequests.map((item) => (
                <div key={item.id} className="request-item">
                  <div>
                    <strong>{item.service?.name || "Сервис"}</strong>
                    <span>{item.justification || "Без комментария"}</span>
                    <span>
                      Запрошено: {item.requested_at ? new Date(item.requested_at).toLocaleString("ru-RU") : "-"}
                    </span>
                    {item.reviewed_at && (
                      <span>
                        Рассмотрено: {new Date(item.reviewed_at).toLocaleString("ru-RU")}
                      </span>
                    )}
                  </div>
                  <div className="request-item-actions">
                    <span className={`status-pill ${item.status || "pending"}`}>
                      {requestStatusLabel[item.status] || item.status}
                    </span>
                    {item.status === "pending" && (
                      <button
                        className="btn btn-mini danger"
                        type="button"
                        onClick={() => onCancelAccessRequest(item.id)}
                        disabled={accessRequestStatus.loading}
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <main className="sections">
        {filteredSections.length === 0 ? (
          <div className="empty-state">
            <h3>Сервисы ещё не назначены</h3>
            <p>Свяжитесь с руководителем отдела, чтобы получить доступ.</p>
          </div>
        ) : (
          filteredSections.map((section) => (
            <div key={section.id} className={`section ${accentClass[section.accent] || "accent-sky"}`}>
              <div className="section-header">
                <div>
                  <h3>{section.name}</h3>
                  <p>{section.tagline}</p>
                </div>
                <div className="section-count">{section.services.length} учёток</div>
              </div>
              <div className="service-grid">
                {section.services.map((service) => (
                  <article key={service.id} className="service-card">
                    <div className="service-head">
                      <div className="service-icon">
                        {(service.owner_login || service.name).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="service-name">
                          {service.owner_name || service.owner_login || "Сотрудник"}
                        </div>
                        <div className="service-url">
                          {service.owner_login || "Без логина"}
                          {" | "}
                          Отдел: {service.owner_department || "Без отдела"}
                        </div>
                      </div>
                      <a className="btn btn-mini" href={service.url} target="_blank" rel="noreferrer">
                        Открыть
                      </a>
                    </div>
                    <div className="service-body">
                      <div className="cred">
                        <span>Логин</span>
                        <strong>{service.login}</strong>
                        <div className="cred-actions">
                          <button
                            className="reveal"
                            type="button"
                            onClick={() => onCopyField?.(service.login, "Логин")}
                          >
                            Копировать
                          </button>
                        </div>
                      </div>
                      <div className="cred">
                        <span>Пароль</span>
                        <strong>{revealed[service.id] ? service.password : "••••••••"}</strong>
                        <div className="cred-actions">
                          <button className="reveal" type="button" onClick={() => onToggleReveal(service.id)}>
                            {revealed[service.id] ? "Скрыть" : "Показать"}
                          </button>
                          <button
                            className="reveal"
                            type="button"
                            onClick={() => onCopyField?.(service.password, "Пароль")}
                          >
                            Копировать
                          </button>
                        </div>
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
  );
}
