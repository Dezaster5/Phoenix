import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VaultPage from "./VaultPage";

const baseProps = {
  serviceGroupsCount: 1,
  search: "",
  onSearchChange: () => {},
  serviceFilter: "all",
  onServiceFilterChange: () => {},
  serviceOptions: [{ id: "service-1", name: "Repo" }],
  filteredSections: [
    {
      id: "service-1",
      name: "Repo",
      url: "https://repo.local",
      services: [
        {
          id: 7,
          name: "Repo",
          url: "https://repo.local",
          login: "emp@login",
          secret_type: "password",
          password: "super-secret",
          notes: "notes"
        }
      ]
    }
  ],
  onCopyField: () => {},
  onDownloadCredentialSecret: () => {}
};

describe("VaultPage", () => {
  it("keeps secrets masked by default and reveals them on explicit interaction", async () => {
    const user = userEvent.setup();

    render(<VaultPage {...baseProps} />);

    expect(screen.getByText("••••••••")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Показать секрет" }));
    expect(screen.getByRole("button", { name: "super-secret" })).toBeInTheDocument();
  });

  it("copies login and secret via explicit actions", async () => {
    const user = userEvent.setup();
    const onCopyField = vi.fn();

    render(<VaultPage {...baseProps} onCopyField={onCopyField} />);

    await user.click(screen.getByRole("button", { name: "emp@login" }));
    expect(onCopyField).toHaveBeenNthCalledWith(1, "emp@login", "Логин");

    await user.click(screen.getByRole("button", { name: "Показать секрет" }));
    await user.click(screen.getByRole("button", { name: "super-secret" }));
    expect(onCopyField).toHaveBeenNthCalledWith(2, "super-secret", "Секрет");
  });
});
