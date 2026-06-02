import { useState } from "react";

export default function AuthPage({
  status,
  portalLogin,
  onPortalLoginChange,
  challengeRequired,
  loginCode,
  onLoginCodeChange,
  onLogin,
  registrationForm = { iin: "", department_id: "", portal_login: "" },
  registrationStatus = { loading: false, error: "", success: "" },
  publicDepartments = [],
  onRegistrationChange = () => () => {},
  onRegisterByIin = () => {}
}) {
  const [mode, setMode] = useState("login");

  return (
    <section className="auth-layout">
      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Вход или регистрация">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
            onClick={() => setMode("login")}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
            onClick={() => setMode("register")}
          >
            Регистрация по ИИН
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={onLogin}>
            <div className="auth-title-group">
              <h1>Вход в Phoenix Vault</h1>
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

          </form>
        ) : (
          <form onSubmit={onRegisterByIin}>
            <div className="auth-title-group">
              <h1>Регистрация по ИИН</h1>
              <p>Мы проверим сотрудника по ИИН. Если он уже зарегистрирован, дубль создан не будет.</p>
            </div>

            <label className="field">
              <span>ИИН</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={registrationForm.iin}
                onChange={onRegistrationChange("iin")}
                placeholder="12 цифр"
              />
            </label>

            <label className="field">
              <span>Отдел</span>
              <select
                value={registrationForm.department_id}
                onChange={onRegistrationChange("department_id")}
              >
                <option value="">Выберите отдел</option>
                {publicDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Логин для входа</span>
              <input
                type="text"
                value={registrationForm.portal_login}
                onChange={onRegistrationChange("portal_login")}
                placeholder="например, ivan.ivanov"
              />
            </label>

            {registrationStatus.error && <div className="inline-error">{registrationStatus.error}</div>}
            {registrationStatus.success && <div className="inline-success">{registrationStatus.success}</div>}

            <button className="btn btn-primary" type="submit" disabled={registrationStatus.loading}>
              {registrationStatus.loading ? "Проверяем..." : "Зарегистрироваться"}
            </button>

            <p className="hint auth-note">
              После регистрации вы получите роль сотрудника. Руководитель отдела назначит нужные доступы.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
