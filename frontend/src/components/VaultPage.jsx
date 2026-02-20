import { useEffect, useMemo, useState } from "react";

const PASSWORD_VISIBLE_MS = 10000;

export default function VaultPage({
  serviceGroupsCount,
  search,
  onSearchChange,
  serviceFilter,
  onServiceFilterChange,
  serviceOptions,
  filteredSections,
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
  const [nowTs, setNowTs] = useState(Date.now());
  const [passwordVisibleUntil, setPasswordVisibleUntil] = useState({});

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(
    () =>
      filteredSections.flatMap((section) =>
        section.services.map((service) => ({
          ...service,
          sectionName: section.name,
          serviceUrl: service.url || section.url || ""
        }))
      ),
    [filteredSections]
  );

  const requestStatusLabel = {
    pending: "ожидает",
    approved: "одобрен",
    rejected: "отклонен",
    canceled: "отменен"
  };

  const showPasswordForTenSeconds = (rowId) => {
    setPasswordVisibleUntil((prev) => ({ ...prev, [rowId]: Date.now() + PASSWORD_VISIBLE_MS }));
  };

  const isPasswordVisible = (rowId) => Number(passwordVisibleUntil[rowId] || 0) > nowTs;
  const remainingSeconds = (rowId) =>
    Math.max(0, Math.ceil((Number(passwordVisibleUntil[rowId] || 0) - nowTs) / 1000));

  const handleCopyPassword = (row) => {
    if (!isPasswordVisible(row.id)) {
      window.alert("Сначала нажмите «Показать на 10 сек».");
      return;
    }
    onCopyField?.(row.password, "Пароль");
  };

  return (
    <section className="workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Vault</h2>
            <p>Мои доступы: сервисов {serviceGroupsCount}, учетных записей {rows.length}</p>
          </div>
        </div>

        <div className="toolbar-row">
          <input
            type="search"
            placeholder="Поиск по сервису, логину или примечанию"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <select value={serviceFilter} onChange={(event) => onServiceFilterChange(event.target.value)}>
            <option value="all">Все сервисы</option>
            {serviceOptions.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            Нет доступов. Запросите сервис у руководителя.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Сервис</th>
                  <th>Пользователь</th>
                  <th>Логин</th>
                  <th>Пароль</th>
                  <th>Примечание</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>{row.sectionName}</div>
                      {row.serviceUrl && (
                        <a href={row.serviceUrl} target="_blank" rel="noreferrer">
                          Открыть
                        </a>
                      )}
                    </td>
                    <td>{row.owner_name || row.owner_login || "Сотрудник"}</td>
                    <td>{row.login}</td>
                    <td>
                      {isPasswordVisible(row.id) ? row.password : "••••••••"}
                    </td>
                    <td>{row.notes || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onCopyField?.(row.login, "Логин")}>
                          Копировать логин
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => showPasswordForTenSeconds(row.id)}>
                          Показать на 10 сек
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => handleCopyPassword(row)}>
                          Копировать пароль
                        </button>
                        {isPasswordVisible(row.id) && (
                          <span className="hint">Скрытие через {remainingSeconds(row.id)}с</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Запрос доступа</h2>
            <p>Выберите сервис из списка и отправьте запрос руководителю.</p>
          </div>
        </div>

        <form className="toolbar-row form-inline" onSubmit={onCreateAccessRequest}>
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
            placeholder="Причина"
            value={accessRequestForm.justification}
            onChange={onAccessRequestChange("justification")}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={accessRequestStatus.loading || !accessRequestForm.service_id}
          >
            {accessRequestStatus.loading ? "Отправка..." : "Отправить"}
          </button>
        </form>

        <details className="help-list">
          <summary>Список доступных сервисов ({requestableServices.length})</summary>
          <ul>
            {requestableServices.map((service) => (
              <li key={service.id}>
                <span>{service.name}</span>
                {service.url && (
                  <a href={service.url} target="_blank" rel="noreferrer">
                    Открыть
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>

        {accessRequestStatus.error && <div className="inline-error">{accessRequestStatus.error}</div>}
        {accessRequestStatus.success && <div className="inline-success">{accessRequestStatus.success}</div>}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Мои заявки</h2>
            <p>Отслеживание статусов запросов.</p>
          </div>
        </div>

        <div className="toolbar-row">
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
            placeholder="Поиск"
            value={ownRequestFilters.query}
            onChange={onOwnRequestFilterChange("query")}
          />
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={onExportOwnRequestsCsv}
            disabled={ownAccessRequests.length === 0}
            title="Экспорт CSV"
          >
            CSV
          </button>
        </div>

        {ownAccessRequests.length === 0 ? (
          <div className="empty-state">Нет заявок. Выберите сервис и отправьте первый запрос.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Сервис</th>
                  <th>Комментарий</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {ownAccessRequests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.service?.name || "Сервис"}</td>
                    <td>{item.justification || "—"}</td>
                    <td>{item.requested_at ? new Date(item.requested_at).toLocaleString("ru-RU") : "—"}</td>
                    <td>{requestStatusLabel[item.status] || item.status}</td>
                    <td>
                      {item.status === "pending" ? (
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={() => onCancelAccessRequest(item.id)}
                          disabled={accessRequestStatus.loading}
                        >
                          Отменить
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hint">Показано {ownAccessRequests.length} из {ownAccessRequestsTotal}</div>
      </div>
    </section>
  );
}
