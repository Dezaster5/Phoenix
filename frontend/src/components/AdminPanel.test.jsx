import { render, screen } from "@testing-library/react";
import AdminPanel from "./AdminPanel";

const employee = {
  id: 10,
  portal_login: "emp.it",
  full_name: "Employee IT",
  email: "",
  role: "employee",
  department: { id: 1, name: "IT" },
  is_active: true,
  is_superuser: false
};

const service = {
  id: 3,
  name: "Repo",
  url: "https://repo.local",
  department: { id: 1, name: "IT" },
  is_active: true
};

const credential = {
  id: 7,
  user: employee,
  service,
  login: "emp@login",
  secret_type: "password",
  password: "secret",
  notes: "",
  is_active: true,
  updated_at: "2026-04-09T10:00:00Z"
};

const baseProps = {
  isSuperuser: false,
  isDepartmentHead: true,
  viewerUserId: 99,
  viewerFullName: "Head IT",
  viewerDepartment: "IT",
  roleLabel: "Руководитель отдела",
  adminTab: "department",
  onAdminTabChange: () => {},
  adminForm: { portal_login: "", full_name: "", email: "", role: "employee", department_id: "" },
  onAdminChange: () => () => {},
  onGenerateLogin: () => {},
  adminDepartments: [{ id: 1, name: "IT" }],
  adminStatus: { loading: false, error: "", success: "" },
  onCreateUser: (event) => event.preventDefault(),
  onEditUser: () => {},
  onDeactivateUser: () => {},
  onResetUserAccess: () => {},
  shareForm: { grantee_id: "", expires_at: "", department_id: "" },
  onShareChange: () => () => {},
  headCandidates: [],
  shareStatus: { loading: false, error: "", success: "" },
  onCreateShare: (event) => event.preventDefault(),
  activeShares: [],
  canRevokeShare: () => false,
  onDeleteShare: () => {},
  writableUsers: [employee],
  adminServices: [service],
  filters: { credentialService: "all" },
  onFilterChange: () => () => {},
  canWriteForUser: () => true,
  credentialForm: {
    user_id: "",
    service_id: "",
    login: "",
    secret_type: "password",
    secret_filename: "",
    ssh_host: "",
    ssh_port: 22,
    ssh_algorithm: "",
    ssh_public_key: "",
    ssh_fingerprint: "",
    password: "",
    notes: ""
  },
  onCredentialChange: () => () => {},
  onCredentialFileChange: () => {},
  credentialStatus: { loading: false, error: "", success: "" },
  onCreateCredential: (event) => event.preventDefault(),
  editCredentialId: null,
  editCredentialForm: {},
  onEditCredentialChange: () => () => {},
  onSaveCredential: () => {},
  onCancelEditCredential: () => {},
  onStartEditCredential: () => {},
  onToggleCredential: () => {},
  onDeleteCredential: () => {},
  onDownloadCredentialSecret: () => {},
  credentialPage: 1,
  setCredentialPage: () => {},
  adminUsers: [employee],
  accessRequests: [],
  accessRequestsTotal: 0,
  accessRequestStatus: { loading: false, error: "", success: "" },
  onApproveAccessRequest: () => {},
  onRejectAccessRequest: () => {},
  reviewComments: {},
  onReviewCommentChange: () => () => {},
  reviewRequestFilters: { status: "all", service: "all", query: "" },
  reviewRequestServiceOptions: [],
  onReviewRequestFilterChange: () => () => {},
  onExportAccessRequestsCsv: () => {},
  auditLogs: [],
  auditStatus: { loading: false, error: "", success: "" },
  auditFilters: { actor: "", action: "all", object_type: "all", date_from: "", date_to: "" },
  auditActorOptions: [],
  auditActionOptions: [],
  auditObjectTypeOptions: [],
  onAuditFilterChange: () => () => {},
  onExportAuditLogs: () => {},
  adminCredentials: [credential],
  selfCredentials: []
};

describe("AdminPanel", () => {
  it("hides employee creation action for department heads", () => {
    render(<AdminPanel {...baseProps} />);

    expect(screen.queryByLabelText("Добавить сотрудника")).not.toBeInTheDocument();
  });

  it("shows employee creation action for superuser", () => {
    render(<AdminPanel {...baseProps} isSuperuser adminUsers={[employee]} />);

    expect(screen.getByLabelText("Добавить сотрудника")).toBeInTheDocument();
  });

  it("renders 'Наименование' column and service link in manager credentials table", async () => {
    render(<AdminPanel {...baseProps} />);

    expect(await screen.findByRole("columnheader", { name: "Наименование" })).toBeInTheDocument();
    expect(screen.getAllByText("Repo").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Открыть" })).toHaveAttribute(
      "href",
      "https://repo.local"
    );
  });
});
