import { describe, it, expect } from 'vitest';
import type {
  ApiResponse,
  ApiError,
  PaymentStatus,
  Package,
  Purchase,
} from '../api';

describe('api types', () => {
  it('ApiResponse generic interface works with a string payload', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: 'hello',
    };
    expect(response.success).toBe(true);
    expect(response.data).toBe('hello');
  });

  it('ApiResponse generic interface works with a complex payload', () => {
    const response: ApiResponse<{ id: number; name: string }> = {
      success: true,
      data: { id: 1, name: 'Test' },
      meta: { page: 1, limit: 10, total: 100, totalPages: 10 },
    };
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: 1, name: 'Test' });
    expect(response.meta?.total).toBe(100);
  });

  it('ApiResponse supports error responses', () => {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    };
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('NOT_FOUND');
  });

  it('ApiError has required fields', () => {
    const error: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: { field: 'email', reason: 'required' },
    };
    expect(error.code).toBeDefined();
    expect(error.message).toBeDefined();
    expect(error.details).toBeDefined();
  });

  it('PaymentStatus accepts valid values', () => {
    const statuses: PaymentStatus[] = [
      'pending',
      'processing',
      'completed',
      'failed',
      'refunded',
    ];
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('processing');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('failed');
    expect(statuses).toContain('refunded');
  });

  it('Package has required fields', () => {
    const pkg: Package = {
      id: 1,
      name: 'Basic',
      description: 'Basic fraud risk assessment',
      price: 499,
      currency: 'GBP',
      keyPassCount: 5,
      features: ['Risk Register', 'PDF Report'],
      isActive: true,
    };
    expect(pkg.id).toBeDefined();
    expect(pkg.name).toBeDefined();
    expect(pkg.description).toBeDefined();
    expect(pkg.price).toBeDefined();
    expect(pkg.currency).toBeDefined();
    expect(pkg.keyPassCount).toBeDefined();
    expect(pkg.features).toHaveLength(2);
    expect(pkg.isActive).toBe(true);
  });

  it('Purchase has required fields', () => {
    const purchase: Purchase = {
      id: 'pur-1',
      organisationId: 'org-1',
      packageId: 1,
      amount: 499,
      currency: 'GBP',
      paymentStatus: 'completed',
      keyPassCount: 5,
      createdAt: '2024-01-01',
    };
    expect(purchase.id).toBeDefined();
    expect(purchase.organisationId).toBeDefined();
    expect(purchase.packageId).toBeDefined();
    expect(purchase.amount).toBeDefined();
    expect(purchase.currency).toBeDefined();
    expect(purchase.paymentStatus).toBeDefined();
    expect(purchase.keyPassCount).toBeDefined();
    expect(purchase.createdAt).toBeDefined();
  });

  it('Purchase supports optional fields', () => {
    const purchase: Purchase = {
      id: 'pur-1',
      organisationId: 'org-1',
      packageId: 1,
      amount: 499,
      currency: 'GBP',
      paymentStatus: 'completed',
      stripePaymentId: 'pi_abc123',
      keyPassCount: 5,
      createdAt: '2024-01-01',
      completedAt: '2024-01-01',
    };
    expect(purchase.stripePaymentId).toBe('pi_abc123');
    expect(purchase.completedAt).toBe('2024-01-01');
  });
});
