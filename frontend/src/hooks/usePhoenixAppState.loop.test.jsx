import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import usePhoenixAppState from "./usePhoenixAppState";

function Probe() {
  usePhoenixAppState();
  return null;
}

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => "application/json" },
  json: async () => body,
  text: async () => JSON.stringify(body)
});

describe("usePhoenixAppState initial data loading", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads data a bounded number of times instead of refetching in a loop", async () => {
    localStorage.setItem("phoenixToken", "test-token");
    localStorage.setItem("phoenixRole", "employee");

    const fetchMock = vi.fn(async (url) => {
      const path = String(url);
      if (path.includes("/me/")) {
        return jsonResponse({ id: 1, portal_login: "emp", role: "employee", full_name: "Emp" });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/vault"]}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Let all initial effects and the applyAuthPayload re-render settle.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const settledCalls = fetchMock.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock.mock.calls.length).toBe(settledCalls);
  });
});
