import { useEffect, useMemo, useState } from "react";

const PASSWORD_VISIBLE_MS = 10000;
const PAGE_SIZE = 6;

const getSecretLabel = (secretType) => {
  if (secretType === "ssh_key") return "SSH ключ";
  if (secretType === "api_token") return "API токен";
  return "Пароль";
};

const getSecretPreview = (value) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= 28) return normalized;
  return `${normalized.slice(0, 28)}…`;
};

export default function VaultPage({
  serviceGroupsCount,
  search,
  onSearchChange,
  serviceFilter,
  onServiceFilterChange,
  serviceOptions,
  filteredSections,
  onCopyField,
  onDownloadCredentialSecret
}) {
  const [nowTs, setNowTs] = useState(Date.now());
  const [passwordVisibleUntil, setPasswordVisibleUntil] = useState({});
  const [detailsCredential, setDetailsCredential] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, serviceFilter, rows.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("click", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("click", closeMenu);
    };
  }, []);

  const isPasswordVisible = (rowId) => Number(passwordVisibleUntil[rowId] || 0) > nowTs;

  const togglePasswordVisibility = (rowId) => {
    const currentTs = Date.now();
    setPasswordVisibleUntil((prev) => {
      const visible = Number(prev[rowId] || 0) > currentTs;
      return { ...prev, [rowId]: visible ? 0 : currentTs + PASSWORD_VISIBLE_MS };
    });
  };

  return (
    <section className="workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Мои доступы</h2>
            <p>Сервисов: {serviceGroupsCount}, учетных записей: {rows.length}</p>
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
          <div className="empty-state">Нет доступов. Перейдите во вкладку «Все сервисы», чтобы запросить доступ.</div>
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
                {pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>{row.sectionName}</div>
                      {row.serviceUrl && (
                        <a href={row.serviceUrl} target="_blank" rel="noreferrer">
                          Открыть
                        </a>
                      )}
                    </td>
                    <td>
                      {row.secret_type === "ssh_key" || row.secret_type === "api_token" ? (
                        "—"
                      ) : (
                        <button
                          className="cell-link"
                          type="button"
                          onClick={() => onCopyField?.(row.login, "Логин")}
                          title="Нажмите, чтобы скопировать логин"
                        >
                          {row.login}
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="password-cell">
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => togglePasswordVisibility(row.id)}
                          aria-label={isPasswordVisible(row.id) ? "Скрыть секрет" : "Показать секрет"}
                          title={isPasswordVisible(row.id) ? "Скрыть секрет" : "Показать секрет"}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M12 5C6 5 2.2 9.4 1 12c1.2 2.6 5 7 11 7s9.8-4.4 11-7c-1.2-2.6-5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        {isPasswordVisible(row.id) ? (
                          <button
                            className="cell-link secret-preview"
                            type="button"
                            onClick={() => onCopyField?.(row.password, "Секрет")}
                            title="Нажмите, чтобы скопировать"
                          >
                            {getSecretPreview(row.password)}
                          </button>
                        ) : (
                          <span>••••••••</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        title="Действия"
                        aria-label="Действия"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setOpenMenu((prev) =>
                            prev?.id === row.id
                              ? null
                              : {
                                  id: row.id,
                                  row,
                                  top: rect.bottom + 6,
                                  left: Math.min(
                                    rect.right - 180,
                                    window.innerWidth - 188
                                  )
                                }
                          );
                        }}
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

        {rows.length > PAGE_SIZE && (
          <div className="pagination-row">
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Назад
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Вперед
            </button>
          </div>
        )}
      </div>

      {openMenu && (
        <div
          className="floating-menu"
          style={{
            top: `${Math.max(8, openMenu.top)}px`,
            left: `${Math.max(8, openMenu.left)}px`
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {openMenu.row.secret_type === "ssh_key" && (
            <button
              type="button"
              onClick={() => {
                onDownloadCredentialSecret?.(openMenu.row.id);
                setOpenMenu(null);
              }}
            >
              Скачать ключ
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDetailsCredential(openMenu.row);
              setOpenMenu(null);
            }}
          >
            Подробнее
          </button>
        </div>
      )}

      {detailsCredential && (
        <div className="modal-backdrop" onClick={() => setDetailsCredential(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Подробнее о доступе</h3>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setDetailsCredential(null)}>
                Закрыть
              </button>
            </div>
            <div className="detail-list">
              <div><strong>Сервис:</strong> {detailsCredential.sectionName}</div>
              <div><strong>Тип:</strong> {getSecretLabel(detailsCredential.secret_type)}</div>
              <div><strong>Логин владельца:</strong> {detailsCredential.owner_login || "—"}</div>
              <div><strong>Сотрудник:</strong> {detailsCredential.owner_name || "—"}</div>
              <div><strong>Отдел:</strong> {detailsCredential.owner_department || "—"}</div>
              {detailsCredential.secret_type === "ssh_key" && (
                <>
                  <div><strong>SSH host:</strong> {detailsCredential.ssh_host || "—"}</div>
                  <div><strong>SSH port:</strong> {detailsCredential.ssh_port || "—"}</div>
                  <div><strong>Алгоритм:</strong> {(detailsCredential.ssh_algorithm || "—").toUpperCase()}</div>
                  <div><strong>Fingerprint:</strong> {detailsCredential.ssh_fingerprint || "—"}</div>
                </>
              )}
              <div><strong>Примечание:</strong> {detailsCredential.notes || "—"}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
