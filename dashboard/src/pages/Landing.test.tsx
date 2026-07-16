import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Landing } from './Landing';

describe('Landing', () => {
  it('offers the official Discord invite and previews cross-server Docks', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /for arcane odyssey communities/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /manage servers/i }).length).toBeGreaterThan(0);
    screen.getAllByRole('link', { name: /add to discord/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/invite');
    });
    expect(screen.getByRole('link', { name: /scroll to explore features/i })).toHaveAttribute('href', '#features');
    expect(screen.getByRole('heading', { name: /connect with communities through docks/i, level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('Chibi [Dragon Hunts] [Sunfish Village]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Dragon Hunts ping triggered by Chibi!/i)).toBeInTheDocument();
    expect(screen.getByText('9/14 Members')).toBeInTheDocument();
  });
});
