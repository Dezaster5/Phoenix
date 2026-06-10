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
  it("uses the business label 'Наименование' for service names", () => {
    render(<VaultPage {...baseProps} />);

    expect(screen.getByRole("columnheader", { name: "Наименование" })).toBeInTheDocument();
  });

  it("keeps secrets masked by default and reveals them on explicit interaction", async () => {
    const user = userEvent.setup();

    render(<VaultPage {...baseProps} />);

    expect(screen.getByText("••••••••")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Показать секрет" }));
    expect(screen.getByRole("button", { name: "super-secret" })).toBeInTheDocument();
  });

  it("renders the add button only when self-service handlers are provided", () => {
    const { rerender } = render(<VaultPage {...baseProps} />);
    expect(screen.queryByRole("button", { name: "Добавить доступ" })).not.toBeInTheDocument();

    rerender(<VaultPage {...baseProps} onOpenCreateCredential={() => {}} />);
    expect(screen.getByRole("button", { name: "Добавить доступ" })).toBeInTheDocument();
  });

  it("opens the credential form and submits it", async () => {
    const user = userEvent.setup();
    const onOpenCreateCredential = vi.fn();
    const onSubmitCredential = vi.fn((event) => event.preventDefault());

    render(
      <VaultPage
        {...baseProps}
        onOpenCreateCredential={onOpenCreateCredential}
        credentialFormOpen
        credentialForm={{
          id: null,
          service_id: "",
          login: "",
          secret_type: "password",
          password: "",
          notes: ""
        }}
        credentialStatus={{ loading: false, error: "", success: "" }}
        onCredentialChange={() => () => {}}
        onCloseCredentialForm={() => {}}
        onSubmitCredential={onSubmitCredential}
        vaultServices={[{ id: 1, name: "Repo" }]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Добавить доступ" }));
    expect(onOpenCreateCredential).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSubmitCredential).toHaveBeenCalled();
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
