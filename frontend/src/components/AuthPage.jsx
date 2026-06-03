export default function AuthPage({
  status,
  loginForm = { email: "", password: "" },
  onLoginFormChange = () => () => {},
  onLogin = () => {},
  registrationForm = {
    email: "",
    iin: "",
    department_id: "",
    password: "",
    password_confirm: ""
  },
  registrationStep = "form",
  registrationCode = "",
  onRegistrationCodeChange = () => {},
  registrationStatus = { loading: false, error: "", success: "" },
  publicDepartments = [],
  onRegistrationChange = () => () => {},
  onRegisterRequest = () => {},
  onRegisterVerify = () => {},
  onRegistrationBack = () => {},
  resetForm = { email: "", password: "", password_confirm: "" },
  resetStep = "email",
  resetCode = "",
  onResetFormChange = () => () => {},
  onResetCodeChange = () => {},
  resetStatus = { loading: false, error: "", success: "" },
  onResetRequest = () => {},
  onResetConfirm = () => {},
  onResetBack = () => {},
  onOpenReset = () => {},
  onBackToLogin = () => {},
  authMode = "login",
  onAuthModeChange = () => {}
}) {
  const setMode = onAuthModeChange;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode === "login") {
      onBackToLogin();
    }
  };

  const mode = authMode;

  return (
    <section className="auth-layout">
      <div className="auth-card">
        {mode !== "reset" && (
          <div className="auth-tabs" role="tablist" aria-label="Вход или регистрация">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Регистрация
            </button>
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={onLogin}>
            <div className="auth-title-group">
              <h1>Вход в Phoenix Vault</h1>
              <p>Введите корпоративную почту и пароль.</p>
            </div>

            <label className="field">
              <span>Почта</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={onLoginFormChange("email")}
                placeholder="name@company.kz"
                autoFocus
              />
            </label>

            <label className="field">
              <span>Пароль</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={onLoginFormChange("password")}
                placeholder="Ваш пароль"
              />
            </label>

            {status.error && <div className="inline-error">{status.error}</div>}

            <button className="btn btn-primary" type="submit" disabled={status.loading}>
              {status.loading ? "Проверяем..." : "Войти"}
            </button>

            <button className="btn btn-link auth-link-btn" type="button" onClick={() => { onOpenReset(); setMode("reset"); }}>
              Забыли пароль?
            </button>
          </form>
        ) : mode === "reset" ? (
          resetStep === "email" ? (
            <form onSubmit={onResetRequest}>
              <div className="auth-title-group">
                <h1>Сброс пароля</h1>
                <p>Мы отправим код подтверждения на вашу почту.</p>
              </div>

              <label className="field">
                <span>Почта</span>
                <input
                  type="email"
                  value={resetForm.email}
                  onChange={onResetFormChange("email")}
                  placeholder="name@company.kz"
                  autoFocus
                />
              </label>

              {resetStatus.error && <div className="inline-error">{resetStatus.error}</div>}
              {resetStatus.success && <div className="inline-success">{resetStatus.success}</div>}

              <button className="btn btn-primary" type="submit" disabled={resetStatus.loading}>
                {resetStatus.loading ? "Отправляем..." : "Отправить код"}
              </button>

              <button className="btn btn-link auth-link-btn" type="button" onClick={() => switchMode("login")}>
                Вернуться ко входу
              </button>
            </form>
          ) : (
            <form onSubmit={onResetConfirm}>
              <div className="auth-title-group">
                <h1>Новый пароль</h1>
                <p>Введите код из письма и задайте новый пароль.</p>
              </div>

              <label className="field">
                <span>Код подтверждения</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={onResetCodeChange}
                  placeholder="6 цифр"
                />
              </label>

              <label className="field">
                <span>Новый пароль</span>
                <input
                  type="password"
                  value={resetForm.password}
                  onChange={onResetFormChange("password")}
                  placeholder="Минимум 8 символов"
                />
              </label>

              <label className="field">
                <span>Подтверждение пароля</span>
                <input
                  type="password"
                  value={resetForm.password_confirm}
                  onChange={onResetFormChange("password_confirm")}
                  placeholder="Повторите пароль"
                />
              </label>

              {resetStatus.error && <div className="inline-error">{resetStatus.error}</div>}
              {resetStatus.success && <div className="inline-success">{resetStatus.success}</div>}

              <button className="btn btn-primary" type="submit" disabled={resetStatus.loading}>
                {resetStatus.loading ? "Сохраняем..." : "Сбросить пароль"}
              </button>

              <button className="btn btn-link auth-link-btn" type="button" onClick={onResetBack}>
                Назад
              </button>
            </form>
          )
        ) : registrationStep === "form" ? (
          <form onSubmit={onRegisterRequest}>
            <div className="auth-title-group">
              <h1>Регистрация</h1>
              <p>Мы проверим сотрудника по ИИН и отправим код подтверждения на почту.</p>
            </div>

            <label className="field">
              <span>Почта</span>
              <input
                type="email"
                value={registrationForm.email}
                onChange={onRegistrationChange("email")}
                placeholder="name@company.kz"
              />
            </label>

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
              <span>Пароль</span>
              <input
                type="password"
                value={registrationForm.password}
                onChange={onRegistrationChange("password")}
                placeholder="Минимум 8 символов"
              />
            </label>

            <label className="field">
              <span>Подтверждение пароля</span>
              <input
                type="password"
                value={registrationForm.password_confirm}
                onChange={onRegistrationChange("password_confirm")}
                placeholder="Повторите пароль"
              />
            </label>

            {registrationStatus.error && <div className="inline-error">{registrationStatus.error}</div>}
            {registrationStatus.success && <div className="inline-success">{registrationStatus.success}</div>}

            <button className="btn btn-primary" type="submit" disabled={registrationStatus.loading}>
              {registrationStatus.loading ? "Проверяем..." : "Получить код"}
            </button>

            <p className="hint auth-note">
              После регистрации вы получите роль сотрудника. Руководитель отдела назначит нужные доступы.
            </p>
          </form>
        ) : (
          <form onSubmit={onRegisterVerify}>
            <div className="auth-title-group">
              <h1>Подтверждение почты</h1>
              <p>Введите код из письма, отправленного на {registrationForm.email}.</p>
            </div>

            <label className="field">
              <span>Код подтверждения</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={registrationCode}
                onChange={onRegistrationCodeChange}
                placeholder="6 цифр"
                autoFocus
              />
            </label>

            {registrationStatus.error && <div className="inline-error">{registrationStatus.error}</div>}
            {registrationStatus.success && <div className="inline-success">{registrationStatus.success}</div>}

            <button className="btn btn-primary" type="submit" disabled={registrationStatus.loading}>
              {registrationStatus.loading ? "Проверяем..." : "Завершить регистрацию"}
            </button>

            <button className="btn btn-link auth-link-btn" type="button" onClick={onRegistrationBack}>
              Назад
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
