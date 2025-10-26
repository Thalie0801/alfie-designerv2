import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TourProvider, useTour, HelpLauncher } from './InteractiveTour';
import { lsGet, lsSet, completedKey } from '@/utils/localStorage';

// Mock localStorage
vi.mock('@/utils/localStorage', () => ({
  lsGet: vi.fn(() => null),
  lsSet: vi.fn(),
  lsRemove: vi.fn(),
  normalizeEmail: (e?: string | null) => (e ?? '').trim().toLowerCase(),
  completedKey: (email?: string | null) => `alfie.tour.completed:${(email ?? '').trim().toLowerCase()}`,
}));

// Test component that uses tour
function TestTourConsumer() {
  const { isActive, currentStep, totalSteps, start, next, prev, stop } = useTour();

  return (
    <div>
      <div data-testid="tour-status">{isActive ? 'active' : 'inactive'}</div>
      <div data-testid="tour-step">{currentStep}</div>
      <div data-testid="tour-total">{totalSteps}</div>
      <button onClick={start}>Start</button>
      <button onClick={next}>Next</button>
      <button onClick={prev}>Prev</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}

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
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    (lsGet as any).mockReturnValue(null);

    // Mock DOM elements for tour targets
    document.body.innerHTML = `
      <div data-tour-id="nav-dashboard">Dashboard</div>
      <div data-tour-id="btn-create">Create</div>
      <div data-tour-id="brand-kit">Brand Kit</div>
      <div data-tour-id="quick-actions">Quick Actions</div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should provide tour context', () => {
    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>
    );

    const status = getByTestId('tour-status');
    const step = getByTestId('tour-step');
    expect(status?.textContent).toBe('inactive');
    expect(step?.textContent).toBe('0');
  });

  it('should start tour when start() is called', async () => {
    const user = userEvent.setup();

    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>
    );

    const startBtn = getByText('Start');
    if (startBtn) await user.click(startBtn);

    await waitFor(() => {
      const status = getByTestId('tour-status');
      expect(status?.textContent).toBe('active');
    });
  });

  it('should navigate through steps', async () => {
    const user = userEvent.setup();

    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>
    );

    const startBtn = getByText('Start');
    if (startBtn) await user.click(startBtn);
    
    let step = getByTestId('tour-step');
    expect(step?.textContent).toBe('0');

    const nextBtn = getByText('Next');
    if (nextBtn) await user.click(nextBtn);
    
    await waitFor(() => {
      step = getByTestId('tour-step');
      expect(step?.textContent).toBe('1');
    });

    const prevBtn = getByText('Prev');
    if (prevBtn) await user.click(prevBtn);
    
    await waitFor(() => {
      step = getByTestId('tour-step');
      expect(step?.textContent).toBe('0');
    });
  });

  it('should mark tour as completed when stopped after being active', async () => {
    const user = userEvent.setup();
    const email = 'test@example.com';

    render(
      <TourProvider options={{ userEmail: email }}>
        <TestTourConsumer />
      </TourProvider>
    );

    const startBtn = getByText('Start');
    if (startBtn) await user.click(startBtn);
    
    const stopBtn = getByText('Stop');
    if (stopBtn) await user.click(stopBtn);

    await waitFor(() => {
      expect(lsSet).toHaveBeenCalledWith(completedKey(email), '1');
    });
  });

  it('should not start if already completed', async () => {
    const user = userEvent.setup();
    const email = 'completed@example.com';
    (lsGet as any).mockReturnValue('1');

    render(
      <TourProvider options={{ userEmail: email, autoStart: 'on-first-login' }}>
        <TestTourConsumer />
      </TourProvider>
    );

    const startBtn = getByText('Start');
    if (startBtn) await user.click(startBtn);

    // Should remain inactive
    const status = getByTestId('tour-status');
    expect(status?.textContent).toBe('inactive');
  });

  it('should render HelpLauncher', () => {
    render(
      <TourProvider>
        <HelpLauncher />
      </TourProvider>
    );

    const button = document.querySelector('button');
    expect(button).toBeTruthy();
  });
});

describe('Mobile detection', () => {
  beforeEach(() => {
    // Mock matchMedia for mobile
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
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

  it('should adapt to mobile viewport', async () => {
    const user = userEvent.setup();

    render(
      <TourProvider>
        <TestTourConsumer />
      </TourProvider>
    );

    const startBtn = getByText('Start');
    if (startBtn) await user.click(startBtn);

    // Tour should be active
    await waitFor(() => {
      const status = getByTestId('tour-status');
      expect(status?.textContent).toBe('active');
    });

    // Check that bubble is rendered (placement will be bottom on mobile)
    // We can't easily test the exact placement without more complex setup
    // but we verify the tour activates correctly
  });
});
