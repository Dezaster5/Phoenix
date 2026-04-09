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
  requestEmail: "security@example.com",
  requestSubject: "Запрос логина Phoenix Vault",
  requestTemplate: "ФИО: ____",
  copied: false,
  onCopyTemplate: () => {}
};

describe("AuthPage", () => {
  it("renders a mailto action when support email is configured", () => {
    render(<AuthPage {...baseProps} />);

    const link = screen.getByRole("link", { name: "Запросить логин" });
    expect(link).toHaveAttribute("href");
    expect(link.getAttribute("href")).toContain("mailto:security@example.com");
  });

  it("shows a disabled fallback action when support email is missing", () => {
    render(<AuthPage {...baseProps} requestEmail="" />);

    const button = screen.getByRole("button", { name: "Контакт поддержки не настроен" });
    expect(button).toBeDisabled();
  });

  it("delegates template copy action", async () => {
    const user = userEvent.setup();
    const onCopyTemplate = vi.fn();

    render(<AuthPage {...baseProps} onCopyTemplate={onCopyTemplate} />);

    await user.click(screen.getByRole("button", { name: "Шаблон запроса" }));
    expect(onCopyTemplate).toHaveBeenCalledTimes(1);
  });
});
