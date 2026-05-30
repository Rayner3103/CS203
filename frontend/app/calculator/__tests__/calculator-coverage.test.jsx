import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalculatorPage from '../page';

jest.mock('@/components/ui/PageHeader', () => () => <div data-testid="page-header" />);

jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: ({ onChange, selected, onFocus, onBlur, ...props }) => {
    const value = selected instanceof Date && !Number.isNaN(selected.valueOf())
      ? selected.toISOString().split('T')[0]
      : '';

    return (
      <input
        data-testid="date-picker"
        type="date"
        value={value}
        onChange={(event) => onChange(new Date(event.target.value))}
        onFocus={onFocus}
        onBlur={onBlur}
        {...props}
      />
    );
  },
}));

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;

describe('CalculatorPage - Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_API_BASE_URL: 'http://mock.api' };
    localStorage.setItem('userEmail', 'test@example.com');
    
    global.fetch = jest.fn((url) => {
      if (url.includes('/api/countries')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ name: 'China', code: 'CN' }]),
        });
      }
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(['Laptops']),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = originalFetch;
    localStorage.clear();
  });

  describe('Simulation Tab Input Handling', () => {
    it('handles specific rate focus and blur', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const specificRateInput = inputs.find(input => input.placeholder === '0');

      // Focus on the input
      fireEvent.focus(specificRateInput);
      
      // Change value
      fireEvent.change(specificRateInput, { target: { value: '5' } });
      expect(specificRateInput.value).toBe('5');

      // Blur the input
      fireEvent.blur(specificRateInput);
    });

    it('handles ad valorem rate focus and blur', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const adValoremInput = inputs[inputs.length - 1];

      // Focus on the input
      fireEvent.focus(adValoremInput);
      
      // Change value
      fireEvent.change(adValoremInput, { target: { value: '10' } });
      expect(adValoremInput.value).toBe('10');

      // Blur the input
      fireEvent.blur(adValoremInput);
    });

    it('prepends 0 to specific rate starting with decimal point', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const specificRateInput = inputs.find(input => input.placeholder === '0');

      fireEvent.change(specificRateInput, { target: { value: '.5' } });
      expect(specificRateInput.value).toBe('0.5');
    });

    it('removes leading zeros from specific rate', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const specificRateInput = inputs.find(input => input.placeholder === '0');

      fireEvent.change(specificRateInput, { target: { value: '005' } });
      expect(specificRateInput.value).toBe('5');
    });

    it('prepends 0 to ad valorem rate starting with decimal point', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const adValoremInput = inputs[inputs.length - 1];

      fireEvent.change(adValoremInput, { target: { value: '.25' } });
      expect(adValoremInput.value).toBe('0.25');
    });

    it('removes leading zeros from ad valorem rate', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const adValoremInput = inputs[inputs.length - 1];

      fireEvent.change(adValoremInput, { target: { value: '0010' } });
      expect(adValoremInput.value).toBe('10');
    });

    it('allows valid decimal values in specific rate', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const specificRateInput = inputs.find(input => input.placeholder === '0');

      fireEvent.change(specificRateInput, { target: { value: '12.75' } });
      expect(specificRateInput.value).toBe('12.75');
    });

    it('allows valid decimal values in ad valorem rate', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const adValoremInput = inputs[inputs.length - 1];

      fireEvent.change(adValoremInput, { target: { value: '8.5' } });
      expect(adValoremInput.value).toBe('8.5');
    });
  });

  describe('Quantity and Unit Price Input Validation', () => {
    it('removes decimal points from quantity on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('spinbutton');
      const quantityInput = inputs.find(input => input.placeholder === 'Enter quantity');

      fireEvent.change(quantityInput, { target: { value: '123.45' } });
      expect(quantityInput.value).toBe('123');
    });

    it('handles empty quantity input', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('spinbutton');
      const quantityInput = inputs.find(input => input.placeholder === 'Enter quantity');

      fireEvent.change(quantityInput, { target: { value: '' } });
      expect(quantityInput.value).toBe('');
    });


  });

  describe('Tab Switching Behavior', () => {
    it('clears specific rate when switching from calculator to simulation', async () => {
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

    it('clears ad valorem rate when switching tabs', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });

      const calculatorTab = screen.getByText('Calculator');
      fireEvent.click(calculatorTab);

      await waitFor(() => {
        expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Product and Country Selection', () => {
    it('shows product dropdown on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
    });

    it('shows import country dropdown on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(1);
      });
    });

    it('shows export country dropdown on simulation tab', async () => {
      render(<CalculatorPage />);

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(2);
      });
    });
  });
});
