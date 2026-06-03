import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "./AuthPage";

const baseProps = {
  status: { loading: false, error: "" },
  loginForm: { email: "user@example.com", password: "secret" },
  onLoginFormChange: () => () => {},
  onLogin: (event) => event.preventDefault(),
  authMode: "login",
  onAuthModeChange: () => {},
  registrationForm: {
    email: "new@example.com",
    iin: "123456789012",
    department_id: "1",
    password: "StrongPass123!",
    password_confirm: "StrongPass123!"
  },
  registrationStep: "form",
  registrationCode: "",
  onRegistrationCodeChange: () => {},
  registrationStatus: { loading: false, error: "", success: "" },
  publicDepartments: [{ id: 1, name: "IT" }],
  onRegistrationChange: () => () => {},
  onRegisterRequest: (event) => event.preventDefault(),
  onRegisterVerify: (event) => event.preventDefault(),
  onRegistrationBack: () => {},
  resetForm: { email: "", password: "", password_confirm: "" },
  resetStep: "email",
  resetCode: "",
  onResetFormChange: () => () => {},
  onResetCodeChange: () => {},
  resetStatus: { loading: false, error: "", success: "" },
  onResetRequest: (event) => event.preventDefault(),
  onResetConfirm: (event) => event.preventDefault(),
  onResetBack: () => {},
  onOpenReset: () => {},
  onBackToLogin: () => {}
};

describe("AuthPage", () => {
  it("renders email login form", () => {
    render(<AuthPage {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Вход в Phoenix Vault" })).toBeInTheDocument();
    expect(screen.getByLabelText("Почта")).toHaveValue("user@example.com");
    expect(screen.getByLabelText("Пароль")).toHaveValue("secret");
  });

  it("renders registration form with public departments", async () => {
    const user = userEvent.setup();

    render(<AuthPage {...baseProps} authMode="register" />);

    expect(screen.getByRole("heading", { name: "Регистрация" })).toBeInTheDocument();
    expect(screen.getByLabelText("ИИН")).toHaveValue("123456789012");
    expect(screen.getByRole("option", { name: "IT" })).toBeInTheDocument();
  });

  it("delegates registration submit", async () => {
    const user = userEvent.setup();
    const onRegisterRequest = vi.fn((event) => event.preventDefault());

    render(<AuthPage {...baseProps} authMode="register" onRegisterRequest={onRegisterRequest} />);

    await user.click(screen.getByRole("button", { name: "Получить код" }));

    expect(onRegisterRequest).toHaveBeenCalledTimes(1);
  });
});
