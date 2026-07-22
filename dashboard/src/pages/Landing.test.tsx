import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

describe('Landing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers the official Discord invite and previews its server communities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        servers: [
          { name: 'Grand Navy', iconURL: 'https://cdn.discordapp.com/navy.png', memberCount: 1240 },
          { name: 'Coral Keep', iconURL: null, memberCount: 86 },
        ],
      }),
    }));
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /for arcane odyssey communities/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /manage servers/i }).length).toBeGreaterThan(0);
    screen.getAllByRole('link', { name: /add to discord/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/invite');
    });
    expect(await screen.findAllByText('Grand Navy')).not.toHaveLength(0);
    expect(screen.getAllByText('1,240 members')).not.toHaveLength(0);
    expect(screen.getAllByText('Coral Keep')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: /connect with communities through docks/i, level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('Chibi [Dragon Hunts] [Sunfish Village]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Dragon Hunts ping triggered by Chibi!/i)).toBeInTheDocument();
    expect(screen.getByText('9/14 Members')).toBeInTheDocument();
  });
});
