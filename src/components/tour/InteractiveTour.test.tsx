import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';
import { TourProvider, useTour, HelpLauncher } from './InteractiveTour';
import { lsGet, lsSet, autoCompletedKey } from '@/utils/localStorage';

// Mock localStorage
vi.mock('@/utils/localStorage', () => ({
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
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
  (window as any).requestIdleCallback = (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
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

let root: ReturnType<typeof createRoot> | null = null;
let renderContainer: HTMLElement | null = null;

function cleanup() {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  if (renderContainer && renderContainer.parentElement) {
    renderContainer.parentElement.removeChild(renderContainer);
  }
  renderContainer = null;
}

function render(ui: ReactElement) {
  cleanup();
  renderContainer = document.createElement('div');
  document.body.appendChild(renderContainer);
  act(() => {
    root = createRoot(renderContainer!);
    root.render(ui);
  });
  return { container: renderContainer };
}

const userEvent = {
  setup: () => ({
    click: async (element?: Element | null) => {
      if (!element) return;
      await act(async () => {
        element.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        );
      });
    },
  }),
};

// Helper to get elements
const getByTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const getByText = (text: string) => {
  const elements = Array.from(document.querySelectorAll('button'));
  return elements.find(el => el.textContent === text);
};

const waitFor = (callback: () => void, timeout = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        callback();
        resolve();
      } catch (err) {
        if (Date.now() - start < timeout) {
          setTimeout(check, 50);
        } else {
          reject(err);
        }
      }
    };
    check();
  });
};

describe('InteractiveTour', () => {
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
    document.body.innerHTML = '';
    document.body.innerHTML = "";
  });

  it("should provide tour context", () => {
    const { getByTestId } = render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    expect(getByTestId("tour-status")).toHaveTextContent("inactive");
    expect(getByTestId("tour-step")).toHaveTextContent("0");
  });

  it("should start tour when start() is called", async () => {
    const user = userEvent.setup();

    const { getByRole, getByTestId } = render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getByRole("button", { name: "Start" }));

    await vi.waitFor(() => {
      expect(getByTestId("tour-status")).toHaveTextContent("active");
    });
  });

  it("should navigate through steps", async () => {
    const user = userEvent.setup();

    const { getByRole, getByTestId } = render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getByRole("button", { name: "Start" }));
    expect(getByTestId("tour-step")).toHaveTextContent("0");

    await user.click(getByRole("button", { name: "Next" }));
    // attend incrément
    await vi.waitFor(() => {
      expect(getByTestId("tour-step")).toHaveTextContent("1");
    });

    await user.click(getByRole("button", { name: "Prev" }));
    await vi.waitFor(() => {
      expect(getByTestId("tour-step")).toHaveTextContent("0");
    });
  });

  it("should mark tour as auto-completed when stopped after being active", async () => {
    const user = userEvent.setup();
    const email = "test@example.com";

    const { getByRole } = render(
      <TourProvider options={{ userEmail: email }}>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getByRole("button", { name: "Start" }));
    await user.click(getByRole("button", { name: "Stop" }));

    await vi.waitFor(() => {
      expect(lsSet).toHaveBeenCalledWith(autoCompletedKey(email), "1");
    });
  });

  it("should not start if already completed (autoStart)", async () => {
    const user = userEvent.setup();
    const email = "completed@example.com";
    (lsGet as any).mockReturnValue("1"); // déjà complété

    const { getByRole, getByTestId } = render(
      <TourProvider options={{ userEmail: email, autoStart: "on-first-login" }}>
        <TestTourConsumer />
      </TourProvider>,
    );

    // Même si on clique Start (simule une garde côté start)
    await user.click(getByRole("button", { name: "Start" }));
    expect(getByTestId("tour-status")).toHaveTextContent("inactive");
  });

  it("should render HelpLauncher", () => {
    const { getByRole } = render(
      <TourProvider>
        <HelpLauncher />
      </TourProvider>,
    );
    // au moins un bouton (le lanceur d'aide)
    expect(getByRole("button")).toBeInTheDocument();
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

    const { getByRole, getByTestId } = render(
      <TourProvider options={{ userEmail: email }}>
        <TestForceStart />
      </TourProvider>,
    );

    await user.click(getByRole("button", { name: "Force Start" }));

    await vi.waitFor(() => {
      expect(getByTestId("tour-status")).toHaveTextContent("active");
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

    const { getByRole, getByTestId } = render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>,
    );

    await user.click(getByRole("button", { name: "Start" }));

    await vi.waitFor(() => {
      expect(getByTestId("tour-status")).toHaveTextContent("active");
    });
    // Le positionnement précis n'est pas testé ici ; on valide l'activation en viewport mobile.
  });
});
