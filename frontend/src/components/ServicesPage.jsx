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

export default function ServicesPage({
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
  return (
    <section className="workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Запрос доступа</h2>
            <p>Выберите сервис и отправьте запрос руководителю.</p>
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
            placeholder="Причина запроса"
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
            <p>Показано {ownAccessRequests.length} из {ownAccessRequestsTotal}</p>
          </div>
        </div>

        <div className="toolbar-row">
          <select value={ownRequestFilters.status} onChange={onOwnRequestFilterChange("status")}>
            <option value="all">Все статусы</option>
            <option value="pending">На рассмотрении</option>
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
          <div className="empty-state">
            Нет заявок. Выберите сервис выше и отправьте первый запрос.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Сервис</th>
                  <th>Комментарий</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Ответ руководителя</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {ownAccessRequests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.service?.name || "Сервис"}</td>
                    <td>{item.justification || "—"}</td>
                    <td>{item.requested_at ? new Date(item.requested_at).toLocaleString("ru-RU") : "—"}</td>
                    <td>
                      <span className={getRequestBadgeClass(item.status)}>
                        <span>{getRequestBadgeIcon(item.status)}</span>
                        {requestStatusLabel[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === "pending"
                        ? "—"
                        : item.review_comment || (item.status === "rejected" ? "Причина не указана" : "—")}
                    </td>
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
      </div>
    </section>
  );
}
