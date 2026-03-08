import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EditContactModal from '@/components/EditContactModal';

describe('EditContactModal', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and label', () => {
    const { getByText } = render(
      <EditContactModal
        visible={true}
        label="Fraud Risk Owner"
        currentValue=""
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    expect(getByText('Edit Contact Details')).toBeTruthy();
    expect(getByText('Fraud Risk Owner')).toBeTruthy();
  });

  it('calls onCancel when Cancel pressed', () => {
    const { getByText } = render(
      <EditContactModal
        visible={true}
        label="Test"
        currentValue=""
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.press(getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave when Save pressed with value', () => {
    const { getByText } = render(
      <EditContactModal
        visible={true}
        label="Test"
        currentValue="John Doe"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.press(getByText('Save'));
    expect(mockOnSave).toHaveBeenCalledWith('John Doe');
  });
});
