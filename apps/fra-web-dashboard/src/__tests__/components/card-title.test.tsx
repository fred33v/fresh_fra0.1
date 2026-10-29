import { render, screen } from '@testing-library/react';
import { CardTitle } from '@/components/ui/card';

describe('CardTitle', () => {
  it('is a level 3 heading by default, as before', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByRole('heading', { level: 3, name: 'Title' })).toBeInTheDocument();
  });

  it('can sit at another level so a page outline has no gaps', () => {
    render(<><CardTitle level={1}>One</CardTitle><CardTitle level={2}>Two</CardTitle></>);
    expect(screen.getByRole('heading', { level: 1, name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Two' })).toBeInTheDocument();
  });
});
