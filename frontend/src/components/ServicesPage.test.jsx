import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServicesPage from "./ServicesPage";

const baseProps = {
  requestableServices: [{ id: 1, name: "Repo", url: "https://repo.local" }],
  accessRequestForm: { service_id: "1", justification: "Нужно для работы" },
  onAccessRequestChange: () => () => {},
  onCreateAccessRequest: (event) => event.preventDefault(),
  accessRequestStatus: { loading: false, error: "", success: "" },
  ownAccessRequests: [],
  ownAccessRequestsTotal: 0,
  ownRequestFilters: { status: "all", service: "all", query: "" },
  ownRequestServiceOptions: [{ id: 1, name: "Repo" }],
  onOwnRequestFilterChange: () => () => {},
  onExportOwnRequestsCsv: () => {},
  onCancelAccessRequest: () => {}
};

describe("ServicesPage", () => {
  it("submits the access request form through the provided handler", async () => {
    const user = userEvent.setup();
    const onCreateAccessRequest = vi.fn((event) => event.preventDefault());

    render(<ServicesPage {...baseProps} onCreateAccessRequest={onCreateAccessRequest} />);

    await user.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onCreateAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("renders request badges and cancel action only for pending items", async () => {
    const user = userEvent.setup();
    const onCancelAccessRequest = vi.fn();

    render(
      <ServicesPage
        {...baseProps}
        ownAccessRequests={[
          {
            id: 1,
            service: { name: "Repo" },
            justification: "Нужно",
            requested_at: "2026-04-09T10:00:00Z",
            status: "pending",
            review_comment: ""
          },
          {
            id: 2,
            service: { name: "CRM" },
            justification: "Отчеты",
            requested_at: "2026-04-09T10:00:00Z",
            status: "approved",
            review_comment: "Ок"
          }
        ]}
        ownAccessRequestsTotal={2}
        onCancelAccessRequest={onCancelAccessRequest}
      />
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("На рассмотрении")).toBeInTheDocument();
    expect(within(table).getByText("Одобрен")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Отменить" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Отменить" }));
    expect(onCancelAccessRequest).toHaveBeenCalledWith(1);
    expect(within(table).getByText("Ок")).toBeInTheDocument();
  });

  it("shows the available services disclosure with links", () => {
    render(<ServicesPage {...baseProps} />);

    fireEvent.click(screen.getByText(/Список доступных сервисов/i));
    const link = screen.getByRole("link", { name: "Открыть" });
    expect(link).toHaveAttribute("href", "https://repo.local");
  });
});
