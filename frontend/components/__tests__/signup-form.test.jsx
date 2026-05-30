import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SignupForm } from '../signup-form';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock js-cookie
jest.mock('js-cookie', () => ({
  set: jest.fn(),
}));

describe('SignupForm', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080' };
    global.fetch = jest.fn();
    mockPush.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('renders all required fields', () => {
    render(<SignupForm />);
    
    expect(screen.getByText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('shows error when submitting empty form', async () => {
    render(<SignupForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/all fields are required/i)).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password2' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('updates input values when user types', () => {
    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });

    expect(emailInput.value).toBe('newuser@example.com');
    expect(passwordInput.value).toBe('SecurePass1');
    expect(confirmPasswordInput.value).toBe('SecurePass1');
  });

  it('calls API with correct data on submit', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Account created successfully!', token: 'mock-token' }),
    });

    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/users/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'newuser@example.com', password: 'SecurePass1' }),
        }
      );
    });
  });

  it('shows success message on successful signup', async () => {
    // Mock register call
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Account created!' }),
    });
    // Mock login call after signup
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Login successful!', token: 'mock-token' }),
    });

    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failed signup', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Email already exists' }),
    });

    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('shows network error on fetch failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('shows loading text during submission', async () => {
    // Mock register call
    global.fetch.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ message: 'Success' }),
      }), 50))
    );
    // Mock login call
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Login successful!', token: 'mock-token' }),
    });

    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });
    fireEvent.click(submitButton);

    // Check loading state
    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();

    // Wait for completion - increased timeout for the 2 second delay in signup
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 5000 });
  });



  it('redirects to dashboard on successful signup', async () => {
    // Mock register call
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Account created!' }),
    });
    // Mock login call
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Login successful!', token: 'mock-token' }),
    });

    render(<SignupForm />);
    
    const inputs = screen.getAllByDisplayValue('');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const confirmPasswordInput = inputs[2];
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass1' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'SecurePass1' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 5000 });
  });
});
