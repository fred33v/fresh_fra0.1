import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinSessionCard } from '@/components/JoinSessionCard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));

describe('JoinSessionCard', () => {
  it('asks for the session code and opens that live session', async () => {
    render(<JoinSessionCard />);
    await userEvent.click(screen.getByRole('button', { name: /Join Session/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the session code');
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Session code'), 'ab12 cd');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(mockNavigate).toHaveBeenCalledWith('/workshop?session=AB12CD');
  });
});
