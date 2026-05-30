import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import CalculatorPage from '../page';

jest.mock('@/components/ui/PageHeader', () => () => <div data-testid="page-header" />);

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

const findSummaryItem = (summary, text) => {
  const items = within(summary).getAllByRole('listitem');
  return items.find(item => item.textContent.includes(text));
};

describe('CalculatorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_API_BASE_URL: 'http://mock.api' };
    localStorage.setItem('userEmail', 'test@example.com');
    
    // Default mock for all tests
    global.fetch = jest.fn((url) => {
      if (url.includes('/api/countries')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { name: 'China', code: 'CN' }, 
            { name: 'United States', code: 'US' },
            { name: 'World', code: 'WLD' },
            { name: 'Unspecified', code: 'UNS' }
          ]),
        });
      }
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ name: 'Laptops' }, { name: 'Phones' }]),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    localStorage.clear();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('Initial Rendering', () => {
    it('renders calculator tab by default', async () => {
      render(<CalculatorPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Tariff Calculator')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Calculator')).toBeInTheDocument();
      expect(screen.getByText('Simulation')).toBeInTheDocument();
    });

    it('renders placeholder summary values on first load', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getByRole('list')).toBeInTheDocument();
      });

      const summary = screen.getByRole('list');
      expect(findSummaryItem(summary, 'Product: -')).toBeInTheDocument();
      expect(findSummaryItem(summary, 'Import Country: -')).toBeInTheDocument();
      expect(findSummaryItem(summary, 'Export Country: -')).toBeInTheDocument();
      expect(findSummaryItem(summary, 'Calculation Date: -')).toBeInTheDocument();
    });

    it('fetches and displays countries and products', async () => {
      render(<CalculatorPage />);

      // Verify API calls were made
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/countries')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/products')
        );
      });

      // Verify selects are rendered
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThanOrEqual(3); // Product, Import Country, Export Country
      });
    });

    it('filters out World and Unspecified countries', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        const importCountrySelect = selects[1];
        
        expect(within(importCountrySelect).getByText('China')).toBeInTheDocument();
        expect(within(importCountrySelect).getByText('United States')).toBeInTheDocument();
        expect(within(importCountrySelect).queryByText('World')).not.toBeInTheDocument();
        expect(within(importCountrySelect).queryByText('Unspecified')).not.toBeInTheDocument();
      });
    });
  });

  describe('Tab Switching', () => {
    it('switches to simulation tab when clicked', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText('Calculator')).toBeInTheDocument();
      });

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      // Check that simulation content is shown
      await waitFor(() => {
        // Simulation tab should have specific rate and ad valorem rate inputs
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });
    });

    it('resets form when switching tabs', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });

      // Fill in calculator form
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Laptops' } });

      // Switch to simulation tab
      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      // Switch back to calculator tab
      const calculatorTab = screen.getByText('Calculator');
      fireEvent.click(calculatorTab);

      // Check that form is reset
      await waitFor(() => {
        const resetSelects = screen.getAllByRole('combobox');
        expect(resetSelects[0].value).toBe('');
      });
    });
  });

  describe('Form Interactions', () => {
    it('updates product selection', async () => {
      render(<CalculatorPage />);

      // Wait for products to load
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        const productSelect = selects[0];
        const options = within(productSelect).getAllByRole('option');
        expect(options.length).toBeGreaterThan(1);
      });

      const productSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(productSelect, { target: { value: 'Laptops' } });

      await waitFor(() => {
        expect(productSelect.value).toBe('Laptops');
      });
    });

    it('updates quantity and unit price', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      const numberInputs = screen.getAllByRole('spinbutton');
      const quantityInput = numberInputs[0];
      const unitPriceInput = numberInputs[1];

      fireEvent.change(quantityInput, { target: { value: '5' } });
      fireEvent.change(unitPriceInput, { target: { value: '500' } });

      expect(quantityInput.value).toBe('5');
      expect(unitPriceInput.value).toBe('500');
    });

    it('updates calculation date', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-picker')).toBeInTheDocument();
      });

      const dateInput = screen.getByTestId('date-picker');
      fireEvent.change(dateInput, { target: { value: '2024-05-01' } });

      expect(dateInput.value).toBe('2024-05-01');
    });
  });

  describe('API Error Handling', () => {
    it('handles countries fetch error gracefully', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/countries')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('/api/products')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([{ name: 'Laptops' }]),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<CalculatorPage />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Tariff Calculator')).toBeInTheDocument();
      });
    });

    it('handles products fetch error gracefully', async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes('/api/countries')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([{ name: 'China', code: 'CN' }]),
          });
        }
        if (url.includes('/api/products')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<CalculatorPage />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Tariff Calculator')).toBeInTheDocument();
      });
    });
  });

  describe('Simulation Tab', () => {
    it('renders simulation form when simulation tab is active', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText('Simulation')).toBeInTheDocument();
      });

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        expect(screen.getByText('Specific Rate')).toBeInTheDocument();
        expect(screen.getByText('Ad Valorem Rate')).toBeInTheDocument();
      });
    });

    it('allows input in simulation rate fields', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText('Simulation')).toBeInTheDocument();
      });

      const simulationTab = screen.getByText('Simulation');
      fireEvent.click(simulationTab);

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Find simulation rate inputs (they should be in the simulation tab)
      const inputs = screen.getAllByRole('spinbutton');
      // Simulation tab has quantity, unit price, specific rate, ad valorem rate
      expect(inputs.length).toBeGreaterThan(2);
    });
  });

  describe('Summary Display', () => {
    it('displays summary section', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        expect(screen.getByText('Tariff Summary')).toBeInTheDocument();
      });

      const summary = screen.getByRole('list');
      expect(summary).toBeInTheDocument();
    });

    it('updates summary when quantity changes', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const quantityInput = screen.getAllByRole('spinbutton')[0];
      fireEvent.change(quantityInput, { target: { value: '10' } });

      await waitFor(() => {
        const summary = screen.getByRole('list');
        expect(findSummaryItem(summary, 'Quantity: 10')).toBeInTheDocument();
      });
    });

    it('updates summary when unit price changes', async () => {
      render(<CalculatorPage />);

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const unitPriceInput = screen.getAllByRole('spinbutton')[1];
      fireEvent.change(unitPriceInput, { target: { value: '250' } });

      await waitFor(() => {
        const summary = screen.getByRole('list');
        const item = findSummaryItem(summary, 'Unit Price:');
        expect(item).toBeTruthy();
        expect(item.textContent).toContain('$250.00');
      });
    });
  });
});
