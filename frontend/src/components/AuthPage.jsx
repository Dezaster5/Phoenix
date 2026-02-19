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
    <section className="auth-page">
      <form className="login-card login-card-minimal" onSubmit={onLogin}>
        <div className="login-header">
          <div>
            <div className="login-title">Вход в Phoenix Vault</div>
            <div className="login-subtitle">Только по выданному логину</div>
          </div>
          <div className={`mode-chip ${status.mode === "demo" ? "mode-demo" : "mode-live"}`}>
            {status.mode === "demo" ? "демо" : "онлайн"}
          </div>
        </div>
        <label>
          Логин
          <input
            type="text"
            value={portalLogin}
            onChange={(event) => onPortalLoginChange(event.target.value)}
            placeholder="например, ivan.ivanov"
          />
        </label>
        {challengeRequired && (
          <label>
            Одноразовый код
            <input
              type="text"
              value={loginCode}
              onChange={(event) => onLoginCodeChange(event.target.value)}
              placeholder="6-значный код"
            />
          </label>
        )}
        {status.error && <div className="login-error">{status.error}</div>}
        <button className="btn btn-primary" type="submit" disabled={status.loading}>
          {status.loading ? "Проверяем..." : challengeRequired ? "Подтвердить код" : "Войти"}
        </button>
        <div className="auth-actions">
          <a
            className="btn btn-outline"
            href={`mailto:${requestEmail}?subject=${encodeURIComponent(
              requestSubject
            )}&body=${encodeURIComponent(requestTemplate)}`}
          >
            Запросить логин
          </a>
          <button className="btn btn-ghost" type="button" onClick={onCopyTemplate}>
            {copied ? "Скопировано" : "Шаблон запроса"}
          </button>
        </div>
        <details className="auth-template">
          <summary>Показать шаблон запроса</summary>
          <pre className="request-template">{requestTemplate}</pre>
        </details>
      </form>
    </section>
  );
}
