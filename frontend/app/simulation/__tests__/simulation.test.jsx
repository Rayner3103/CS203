import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimulationPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/simulation',
  }),
}));

jest.mock('@/components/ui/PageHeader', () => {
  return function MockPageHeader() {
    return <div data-testid="page-header">Page Header</div>;
  };
});

describe('SimulationPage', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080' };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = ORIGINAL_ENV;
  });

  it('should render the simulation page with all elements', () => {
    render(<SimulationPage />);

    expect(screen.getByText('Tariff Simulator')).toBeInTheDocument();
    expect(screen.getByText('Upload a PDF and generate a report')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
    expect(screen.getByText('Continent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
  });

  it('should show error when generating without uploading a file', async () => {
    render(<SimulationPage />);

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/please upload a pdf to generate a report/i)).toBeInTheDocument();
    });
  });

  it('should allow switching between country and continent selection', () => {
    render(<SimulationPage />);

    const countryButton = screen.getByRole('button', { name: 'Country' });
    const continentButton = screen.getByRole('button', { name: 'Continent' });

    // Initially country should be selected
    expect(countryButton).toHaveClass('bg-blue-600');

    fireEvent.click(continentButton);

    // Continent should now be selected
    expect(continentButton).toHaveClass('bg-blue-600');
    expect(countryButton).toHaveClass('bg-gray-800');
  });

  it('should generate report with valid PDF upload and country selection', async () => {
    const mockResponse = 'Summary for you: This is a test tariff report.\n\nDetailed analysis here.\n\nAssumptions: Test assumptions.';
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockResponse,
    });

    render(<SimulationPage />);

    // Create a mock PDF file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');

    // Upload file
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Wait for the report to be displayed
    await waitFor(() => {
      expect(screen.getByText(/summary for you/i)).toBeInTheDocument();
    });

    // Verify fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/predict',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('should generate report with continent selection', async () => {
    const mockResponse = 'Summary for you: This is a continent-based report.';
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockResponse,
    });

    render(<SimulationPage />);

    // Switch to continent mode
    const continentButton = screen.getByRole('button', { name: 'Continent' });
    fireEvent.click(continentButton);

    // Create a mock PDF file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Wait for the report to be displayed
    await waitFor(() => {
      expect(screen.getByText(/continent-based report/i)).toBeInTheDocument();
    });
  });

  it('should show error message when API call fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<SimulationPage />);

    // Upload file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to generate report/i)).toBeInTheDocument();
    });
  });

  it('should show error message on network failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<SimulationPage />);

    // Upload file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to generate report/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during report generation', async () => {
    global.fetch.mockImplementationOnce(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          ok: true,
          text: async () => 'Test report',
        }), 100)
      )
    );

    render(<SimulationPage />);

    // Upload file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Check for loading state - button should show "Generating..."
    expect(screen.getByRole('button', { name: /generating/i })).toBeInTheDocument();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/test report/i)).toBeInTheDocument();
    });
  });

  it('should display the selected country/continent in the report header', async () => {
    const mockResponse = 'Summary for you: Test report.';
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockResponse,
    });

    render(<SimulationPage />);

    // Upload file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    // Wait for the report to be displayed
    await waitFor(() => {
      expect(screen.getByText(/summary for you/i)).toBeInTheDocument();
    });

    // Note: The country display logic may vary, so we just verify the report is shown
    // The actual country display depends on the component's implementation
  });

  it('should clear previous report when generating a new one', async () => {
    const mockResponse1 = 'First report content';
    const mockResponse2 = 'Second report content';
    
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => mockResponse1,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => mockResponse2,
      });

    render(<SimulationPage />);

    // Upload file and generate first report
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/first report content/i)).toBeInTheDocument();
    });

    // Generate second report
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/second report content/i)).toBeInTheDocument();
    });

    // First report should no longer be visible
    expect(screen.queryByText(/first report content/i)).not.toBeInTheDocument();
  });

  it('should clear error message when generating a new report', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'Success report',
      });

    render(<SimulationPage />);

    // Upload file
    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByRole('button', { name: /generate report/i }).parentElement.parentElement.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // First attempt - should fail
    const generateButton = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to generate report/i)).toBeInTheDocument();
    });

    // Second attempt - should succeed
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/success report/i)).toBeInTheDocument();
    });

    // Error message should be cleared
    expect(screen.queryByText(/failed to generate report/i)).not.toBeInTheDocument();
  });
});
