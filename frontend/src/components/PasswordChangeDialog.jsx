export default function PasswordChangeDialog({
  open = false,
  form = { current_password: "", password: "", password_confirm: "" },
  status = { loading: false, error: "", success: "" },
  onChange = () => () => {},
  onSubmit = (event) => event.preventDefault(),
  onClose = () => {}
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <div className="auth-title-group">
            <h2 id="password-change-title">Смена пароля</h2>
            <p>Для смены пароля укажите текущий и новый пароль.</p>
          </div>

          <label className="field">
            <span>Текущий пароль</span>
            <input
              type="password"
              value={form.current_password}
              onChange={onChange("current_password")}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Новый пароль</span>
            <input type="password" value={form.password} onChange={onChange("password")} />
          </label>

          <label className="field">
            <span>Подтверждение пароля</span>
            <input
              type="password"
              value={form.password_confirm}
              onChange={onChange("password_confirm")}
            />
          </label>

          {status.error && <div className="inline-error">{status.error}</div>}
          {status.success && <div className="inline-success">{status.success}</div>}

          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="btn btn-primary" type="submit" disabled={status.loading}>
              {status.loading ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
