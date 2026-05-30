import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalculatorPage from '../page';

jest.mock('@/components/ui/PageHeader', () => () => <div data-testid="page-header" />);

// Mock DatePicker
jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: ({ onChange, selected, ...props }) => {
    const value = selected instanceof Date && !Number.isNaN(selected.valueOf())
      ? selected.toISOString().split('T')[0]
      : '';

    return (
      <input
        data-testid="date-picker"
        type="date"
        value={value}
        onChange={(event) => onChange(new Date(event.target.value))}
        {...props}
      />
    );
  },
}));

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;

describe('CalculatorPage - Advanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080' };
    localStorage.setItem('userEmail', 'test@example.com');

    // Default mocks
    global.fetch = jest.fn((url) => {
      if (url.includes('/api/countries')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { code: 'CN', name: 'China' },
            { code: 'US', name: 'United States' },
            { code: 'WLD', name: 'World' },
          ]),
        });
      }
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(['Laptops', 'Phones']),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = originalFetch;
    localStorage.clear();
  });

  describe('Calculation Logic', () => {
    it('handles zero values correctly', async () => {
      render(<CalculatorPage />);

      const inputs = screen.getAllByRole('spinbutton');
      const quantityInput = inputs[0];
      const unitPriceInput = inputs[1];

      fireEvent.change(quantityInput, { target: { value: '0' } });
      fireEvent.change(unitPriceInput, { target: { value: '0' } });

      await waitFor(() => {
        const summary = screen.getByRole('list');
        expect(summary.textContent).toContain('0.00');
      });
    });
  });

  describe('Simulation Tab Advanced', () => {
    it('allows decimal input in rate fields', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const specificRateInput = inputs.find(input => input.placeholder === '0');

      if (specificRateInput) {
        fireEvent.change(specificRateInput, { target: { value: '2.5' } });
        expect(specificRateInput.value).toBe('2.5');
      }
    });

    it('handles large quantity values', async () => {
      render(<CalculatorPage />);

      const inputs = screen.getAllByRole('spinbutton');
      const quantityInput = inputs[0];

      fireEvent.change(quantityInput, { target: { value: '10000' } });

      expect(quantityInput.value).toBe('10000');
    });

    it('handles high unit prices', async () => {
      render(<CalculatorPage />);

      const inputs = screen.getAllByRole('spinbutton');
      const unitPriceInput = inputs[1];

      fireEvent.change(unitPriceInput, { target: { value: '9999.99' } });

      expect(unitPriceInput.value).toBe('9999.99');
    });
  });

  describe('Tab Switching', () => {
    it('switches between calculator and simulation tabs', async () => {
      render(<CalculatorPage />);

      // Initially on calculator tab
      await waitFor(() => {
        expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
      });

      // Switch to simulation
      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      // Switch back to calculator
      const calculatorTab = screen.getByText('Calculator');
      fireEvent.click(calculatorTab);

      await waitFor(() => {
        expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Input Validation', () => {
    it('accepts valid numeric input', async () => {
      render(<CalculatorPage />);

      const inputs = screen.getAllByRole('spinbutton');
      const quantityInput = inputs[0];

      fireEvent.change(quantityInput, { target: { value: '123' } });

      expect(quantityInput.value).toBe('123');
    });

    it('handles negative values', async () => {
      render(<CalculatorPage />);

      const inputs = screen.getAllByRole('spinbutton');
      const quantityInput = inputs[0];

      // Try to enter negative value
      fireEvent.change(quantityInput, { target: { value: '-5' } });

      // The input should accept it (browser validation will handle it)
      expect(quantityInput.value).toBe('-5');
    });
  });

  describe('Product Selection', () => {
    it('shows product dropdown on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
    });


  });

  describe('Rate Fields', () => {
    it('shows specific rate field on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });
    });

    it('shows ad valorem rate field on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });
    });

    it('rate fields are editable on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const specificRateInput = inputs.find(input => input.placeholder === '0');

      expect(specificRateInput).not.toHaveAttribute('readOnly');
    });
  });
});
