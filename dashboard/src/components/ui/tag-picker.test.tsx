import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TagPicker } from './tag-picker';

const options = [
  { value: 'dragon', label: 'Dragon Hunters' },
  { value: 'raiders', label: 'Fort Raiders' },
  { value: 'sailors', label: 'Dark Sea Sailors' },
];

function Picker() {
  const [values, setValues] = useState<string[]>([]);
  return (
    <TagPicker
      label="Allowed roles"
      options={options}
      values={values}
      onChange={setValues}
      placeholder="Search roles…"
    />
  );
}

describe('TagPicker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds clicked results and the top Enter result as removable tags without requests', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<Picker />);

    const input = screen.getByRole('combobox', { name: 'Allowed roles' });
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('option', { name: 'Dragon Hunters' }));
    expect(screen.getByText('Dragon Hunters')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'fort' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Fort Raiders')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Dragon Hunters' }));
    expect(screen.queryByRole('button', { name: 'Remove Dragon Hunters' })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
