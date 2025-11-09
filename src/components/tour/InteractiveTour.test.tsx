import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { TourProvider, useTour, HelpLauncher } from "./InteractiveTour";
import { lsSet, autoCompletedKey } from "@/utils/localStorage";

vi.mock("@/utils/localStorage", () => ({
  lsGet: vi.fn(() => null),
  lsSet: vi.fn(),
  lsRemove: vi.fn(),
  normalizeEmail: (email?: string | null) => (email ?? "").trim().toLowerCase(),
  completedKey: (email?: string | null) => `alfie.tour.completed:${(email ?? "").trim().toLowerCase()}`,
  autoCompletedKey: (email?: string | null) => `alfie.tour.auto-completed:${(email ?? "").trim().toLowerCase()}`,
}));

function TestConsumer() {
  const { isActive, currentStep, totalSteps, start, next, prev, stop } = useTour();
  return (
    <div>
      <div data-testid="tour-status">{isActive ? "active" : "inactive"}</div>
      <div data-testid="tour-step">{currentStep}</div>
      <div data-testid="tour-total">{totalSteps}</div>
      <button type="button" onClick={() => start()}>
        Start
      </button>
      <button type="button" onClick={next}>
        Next
      </button>
      <button type="button" onClick={prev}>
        Prev
      </button>
      <button type="button" onClick={stop}>
        Stop
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  (window as any).requestIdleCallback = (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
  (window as any).cancelIdleCallback = (id: number) => clearTimeout(id);

  document.body.innerHTML = `
    <div data-tour-id="nav-dashboard">Dashboard</div>
    <div data-tour-id="btn-create">Create</div>
    <div data-tour-id="brand-kit">Brand Kit</div>
    <div data-tour-id="quick-actions">Quick Actions</div>
  `;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("InteractiveTour", () => {
  it("provides tour context values", () => {
    render(
      <TourProvider>
        <TestConsumer />
      </TourProvider>,
    );

    expect(screen.getByTestId("tour-status")).toHaveTextContent("inactive");
    expect(screen.getByTestId("tour-step")).toHaveTextContent("0");
    expect(screen.getByTestId("tour-total")).toBeInTheDocument();
  });

  it("marks the tour as auto-completed when stopped", async () => {
    const user = userEvent.setup();
    const email = "tour@example.com";

    render(
      <TourProvider options={{ userEmail: email }}>
        <TestConsumer />
      </TourProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    await vi.waitFor(() => {
      expect(lsSet).toHaveBeenCalledWith(autoCompletedKey(email), "1");
    });
  });

  it("renders the help launcher button", () => {
    render(
      <TourProvider>
        <HelpLauncher />
      </TourProvider>,
    );

    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
