import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

function renderWithRouter(ui, initialEntries = ["/protected"]) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/denied" element={<div>denied-page</div>} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    renderWithRouter(
      <ProtectedRoute isAuthenticated={false}>
        <div>secret-content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("redirects forbidden users to the provided fallback path", () => {
    renderWithRouter(
      <ProtectedRoute isAuthenticated isAllowed={false} redirectTo="/denied">
        <div>secret-content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("denied-page")).toBeInTheDocument();
  });

  it("renders children when authentication and authorization pass", () => {
    renderWithRouter(
      <ProtectedRoute isAuthenticated isAllowed>
        <div>secret-content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("secret-content")).toBeInTheDocument();
  });
});
