export default function AuthPage({
  status,
  portalLogin,
  onPortalLoginChange,
  challengeRequired,
  loginCode,
  onLoginCodeChange,
  onLogin,
  requestEmail,
  requestSubject,
  requestTemplate,
  copied,
  onCopyTemplate
}) {
  return (
    <section className="auth-layout">
      <form className="auth-card" onSubmit={onLogin}>
        <div className="auth-title-group">
          <h1>Вход в Avatariya Vault</h1>
          <p>Введите логин, который выдал руководитель или администратор.</p>
        </div>

        <label className="field">
          <span>Логин</span>
          <input
            type="text"
            value={portalLogin}
            onChange={(event) => onPortalLoginChange(event.target.value)}
            placeholder="например, ivan.ivanov"
            autoFocus
          />
        </label>

        {challengeRequired && (
          <label className="field">
            <span>Одноразовый код</span>
            <input
              type="text"
              value={loginCode}
              onChange={(event) => onLoginCodeChange(event.target.value)}
              placeholder="6-значный код"
            />
          </label>
        )}

        {status.error && <div className="inline-error">{status.error}</div>}

        <button className="btn btn-primary" type="submit" disabled={status.loading}>
          {status.loading ? "Проверяем..." : challengeRequired ? "Подтвердить код" : "Войти"}
        </button>

        <div className="auth-secondary-actions">
          <a
            className="btn btn-secondary btn-sm"
            href={`mailto:${requestEmail}?subject=${encodeURIComponent(
              requestSubject
            )}&body=${encodeURIComponent(requestTemplate)}`}
          >
            Запросить логин
          </a>
          <button className="btn btn-link btn-sm" type="button" onClick={onCopyTemplate}>
            {copied ? "Шаблон скопирован" : "Шаблон запроса"}
          </button>
        </div>

        <details className="auth-help">
          <summary>Как получить логин?</summary>
          <p>Отправьте руководителю запрос по шаблону:</p>
          <pre>{requestTemplate}</pre>
        </details>
      </form>
    </section>
  );
}
