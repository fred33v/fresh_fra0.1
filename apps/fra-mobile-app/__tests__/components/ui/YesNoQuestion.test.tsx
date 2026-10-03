/**
 * YesNoQuestion Component - Unit Tests
 *
 * The follow-up box appears after "Yes" and saves through onFollowUpChange when given
 * (used by the Cash & Banking, IT Systems, Payroll & HR, People & Culture, Revenue and
 * Controls & Technology screens), otherwise through onChange's second argument.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { YesNoQuestion } from '@/components/ui/YesNoQuestion';

const QUESTION = 'Have you experienced any fraud incidents?';
const FOLLOW_UP = 'Please describe the incident(s)';

describe('YesNoQuestion', () => {
  it('hides the follow-up until the answer is yes', () => {
    const { queryByText, rerender } = render(
      <YesNoQuestion question={QUESTION} followUp={FOLLOW_UP} value="no" onChange={jest.fn()} />,
    );
    expect(queryByText(FOLLOW_UP)).toBeNull();

    rerender(<YesNoQuestion question={QUESTION} followUp={FOLLOW_UP} value="yes" onChange={jest.fn()} />);
    expect(queryByText(FOLLOW_UP)).toBeTruthy();
  });

  it('saves follow-up text through onFollowUpChange when provided', () => {
    const onChange = jest.fn();
    const onFollowUpChange = jest.fn();
    const { getByPlaceholderText } = render(
      <YesNoQuestion question={QUESTION} followUp={FOLLOW_UP} value="yes" onChange={onChange} onFollowUpChange={onFollowUpChange} />,
    );

    fireEvent.changeText(getByPlaceholderText('Please provide details...'), 'Duplicate invoice paid');

    expect(onFollowUpChange).toHaveBeenCalledWith('Duplicate invoice paid');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('falls back to onChange with the text when no follow-up handler is given', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <YesNoQuestion question={QUESTION} followUp={FOLLOW_UP} value="yes" onChange={onChange} />,
    );

    fireEvent.changeText(getByPlaceholderText('Please provide details...'), 'Details');

    expect(onChange).toHaveBeenCalledWith('yes', 'Details');
  });
});
