/**
 * CurrencyQuestion Component - Unit Tests
 *
 * Money questions show £; counts take whole numbers only; percentages show % and cap at 100.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CurrencyQuestion } from '@/components/ui/CurrencyQuestion';

describe('CurrencyQuestion', () => {
  it('shows a pound sign for money and keeps decimals', () => {
    const onChange = jest.fn();
    const { getByText, getByLabelText } = render(<CurrencyQuestion question="Daily cash volume" value={null} onChange={onChange} />);

    expect(getByText('£')).toBeTruthy();
    fireEvent.changeText(getByLabelText('Daily cash volume'), '1250.50');
    expect(onChange).toHaveBeenCalledWith(1250.5);
  });

  it('treats counts as whole numbers with no currency sign', () => {
    const onChange = jest.fn();
    const { queryByText, getByLabelText } = render(<CurrencyQuestion kind="count" question="Bank accounts" value={null} onChange={onChange} />);

    expect(queryByText('£')).toBeNull();
    expect(getByLabelText('Bank accounts').props.placeholder).toBe('0');
    fireEvent.changeText(getByLabelText('Bank accounts'), '4.7');
    expect(onChange).toHaveBeenCalledWith(47);
  });

  it('shows a percent sign and caps percentages at 100', () => {
    const onChange = jest.fn();
    const { getByText, queryByText, getByLabelText } = render(<CurrencyQuestion kind="percent" question="Unpaid invoices" value={null} onChange={onChange} />);

    expect(getByText('%')).toBeTruthy();
    expect(queryByText('£')).toBeNull();
    fireEvent.changeText(getByLabelText('Unpaid invoices'), '140');
    expect(onChange).toHaveBeenCalledWith(100);
  });
});
