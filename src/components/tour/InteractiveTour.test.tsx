import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { TourProvider, useTour, HelpLauncher } from "./InteractiveTour";
import { lsGet, lsSet, autoCompletedKey } from "@/utils/localStorage";

// --- Mocks globales navigateur (jsdom) ---
beforeEach(() => {
  // visibility à "visible"
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

  // matchMedia
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

  // requestIdleCallback
  (window as any).requestIdleCallback = (cb: Function) => setTimeout(cb, 0);
  (window as any).cancelIdleCallback = (id: number) => clearTimeout(id);
});

// --- Mock localStorage utils ---
vi.mock("@/utils/localStorage", () => ({
  lsGet: vi.fn(() => null),
  lsSet: vi.fn(),
  lsRemove: vi.fn(),
  normalizeEmail: (e?: string | null) => (e ?? "").trim().toLowerCase(),
  completedKey: (email?: string | null) => `alfie.tour.completed:${(email ?? "").trim().toLowerCase()}`,
  autoCompletedKey: (email?: string | null) => `alfie.tour.auto-completed:${(email ?? "").trim().toLowerCase()}`,
}));

// --- Composant de test qui consomme le contexte ---
function TestTourConsumer() {
  const { isActive, currentStep, totalSteps, start, next, prev, stop } = useTour();
  return (
    <div>
      <div data-testid="tour-status">{isActive ? "active" : "inactive"}</div>
      <div data-testid="tour-step">{currentStep}</div>
      <div data-testid="tour-total">{totalSteps}</div>
      <button onClick={() => start()}>Start</button>
      <button onClick={next}>Next</button>
      <button onClick={prev}>Prev</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}

// helpers DOM boutons
const getButton = (txt: string) => screen.getByRole("button", { name: txt });

describe("InteractiveTour", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // cibles présentes dans le DOM (le provider se base dessus)
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

  it("should provide tour context", () => {
    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    expect(screen.getByTestId("tour-status")).toHaveTextContent("inactive");
    expect(screen.getByTestId("tour-step")).toHaveTextContent("0");
  });

  it("should start tour when start() is called", async () => {
    const user = userEvent.setup();

    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getButton("Start"));

    await screen.findByText("active"); // attend le passage à actif
    expect(screen.getByTestId("tour-status")).toHaveTextContent("active");
  });

  it("should navigate through steps", async () => {
    const user = userEvent.setup();

    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getButton("Start"));
    expect(screen.getByTestId("tour-step")).toHaveTextContent("0");

    await user.click(getButton("Next"));
    // attend incrément
    await vi.waitFor(() => {
      expect(screen.getByTestId("tour-step")).toHaveTextContent("1");
    });

    await user.click(getButton("Prev"));
    await vi.waitFor(() => {
      expect(screen.getByTestId("tour-step")).toHaveTextContent("0");
    });
  });

  it("should mark tour as auto-completed when stopped after being active", async () => {
    const user = userEvent.setup();
    const email = "test@example.com";

    render(
      <TourProvider options={{ userEmail: email }}>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getButton("Start"));
    await user.click(getButton("Stop"));

    await vi.waitFor(() => {
      expect(lsSet).toHaveBeenCalledWith(autoCompletedKey(email), "1");
    });
  });

  it("should not start if already completed (autoStart)", async () => {
    const user = userEvent.setup();
    const email = "completed@example.com";
    (lsGet as any).mockReturnValue("1"); // déjà complété

    render(
      <TourProvider options={{ userEmail: email, autoStart: "on-first-login" }}>
        <TestTourConsumer />
      </TourProvider>,
    );

    // Même si on clique Start (simule une garde côté start)
    await user.click(getButton("Start"));
    expect(screen.getByTestId("tour-status")).toHaveTextContent("inactive");
  });

  it("should render HelpLauncher", () => {
    render(
      <TourProvider>
        <HelpLauncher />
      </TourProvider>,
    );
    // au moins un bouton (le lanceur d’aide)
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should allow manual restart via force parameter", async () => {
    const user = userEvent.setup();
    const email = "test@example.com";
    (lsGet as any).mockReturnValue("1"); // Tour déjà complété

    function TestForceStart() {
      const { isActive, start } = useTour();
      return (
        <div>
          <div data-testid="tour-status">{isActive ? "active" : "inactive"}</div>
          <button onClick={() => start(true)}>Force Start</button>
        </div>
      );
    }

    render(
      <TourProvider options={{ userEmail: email }}>
        <TestForceStart />
      </TourProvider>,
    );

    await user.click(getButton("Force Start"));

    await vi.waitFor(() => {
      expect(screen.getByTestId("tour-status")).toHaveTextContent("active");
    });
  });
});

describe("Mobile detection", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: q === "(max-width: 767px)",
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

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

  it("should adapt to mobile viewport", async () => {
    const user = userEvent.setup();

    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getButton("Start"));

    await screen.findByText("active");
    expect(screen.getByTestId("tour-status")).toHaveTextContent("active");
    // Le positionnement précis n’est pas testé ici ; on valide l’activation en viewport mobile.
  });
});
