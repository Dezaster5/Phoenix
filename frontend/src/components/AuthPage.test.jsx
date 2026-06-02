import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "./AuthPage";

const baseProps = {
  status: { loading: false, error: "" },
  portalLogin: "",
  onPortalLoginChange: () => {},
  challengeRequired: false,
  loginCode: "",
  onLoginCodeChange: () => {},
  onLogin: (event) => event.preventDefault(),
  registrationForm: { iin: "123456789012", department_id: "1", portal_login: "new.employee" },
  registrationStatus: { loading: false, error: "", success: "" },
  publicDepartments: [{ id: 1, name: "IT" }],
  onRegistrationChange: () => () => {},
  onRegisterByIin: (event) => event.preventDefault()
};

describe("AuthPage", () => {
  it("does not render legacy login request actions", () => {
    render(<AuthPage {...baseProps} />);

    expect(screen.queryByText("Запросить логин")).not.toBeInTheDocument();
    expect(screen.queryByText("Шаблон запроса")).not.toBeInTheDocument();
    expect(screen.queryByText("Как получить логин?")).not.toBeInTheDocument();
    expect(screen.queryByText("Контакт поддержки не настроен")).not.toBeInTheDocument();
  });

  it("renders IIN registration form with public departments", async () => {
    const user = userEvent.setup();

    render(<AuthPage {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Регистрация по ИИН" }));

    expect(screen.getByRole("heading", { name: "Регистрация по ИИН" })).toBeInTheDocument();
    expect(screen.getByLabelText("ИИН")).toHaveValue("123456789012");
    expect(screen.getByRole("option", { name: "IT" })).toBeInTheDocument();
    expect(screen.getByLabelText("Логин для входа")).toHaveValue("new.employee");
  });

  it("delegates IIN registration submit", async () => {
    const user = userEvent.setup();
    const onRegisterByIin = vi.fn((event) => event.preventDefault());

    render(<AuthPage {...baseProps} onRegisterByIin={onRegisterByIin} />);

    await user.click(screen.getByRole("button", { name: "Регистрация по ИИН" }));
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(onRegisterByIin).toHaveBeenCalledTimes(1);
  });
});
