import { Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type TagPickerOption = { value: string; label: string };

export function TagPicker({
  label,
  options,
  values,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches found',
  hint,
  multiple = true,
  max,
  disabled = false,
}: {
  label: string;
  options: TagPickerOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  hint?: string;
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-results`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = values.map((value) => options.find((option) => option.value === value) || { value, label: value });
  const results = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return options
      .filter((option) => !values.includes(option.value))
      .filter((option) => !search || option.label.toLocaleLowerCase().includes(search))
      .slice(0, 8);
  }, [options, query, values]);
  const limitReached = Boolean(multiple && max && values.length >= max);
  const add = (value: string) => {
    onChange(multiple ? [...values, value] : [value]);
    setQuery('');
    setOpen(true);
  };

  return (
    <div
      className="space-y-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <div
          className={cn(
            'flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[#626880]/70 bg-[#414559] px-3 py-2 transition focus-within:border-[#8caaee]/70 focus-within:ring-3 focus-within:ring-[#8caaee]/18',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {selected.map((option) => (
            <span
              key={option.value}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#8caaee]/30 bg-[#8caaee]/12 px-2 py-1 text-xs font-medium text-[#c6d0f5]"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                className="rounded-sm text-[#a5adce] hover:text-[#c6d0f5] focus:outline-none focus:ring-2 focus:ring-[#8caaee]"
                aria-label={`Remove ${option.label}`}
                disabled={disabled}
                onClick={() => onChange(values.filter((value) => value !== option.value))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <div className="flex min-w-36 flex-1 items-center gap-2">
            <input
              id={id}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && !limitReached}
              aria-controls={listId}
              className="min-w-0 flex-1 bg-transparent py-0.5 text-sm text-[#c6d0f5] outline-none placeholder:text-[#838ba7]"
              value={query}
              placeholder={limitReached ? `Limit of ${max} reached` : placeholder}
              disabled={disabled || limitReached}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (results[0] && !limitReached) add(results[0].value);
                } else if (event.key === 'Escape') {
                  setOpen(false);
                } else if (event.key === 'Backspace' && !query && values.length) {
                  onChange(values.slice(0, -1));
                }
              }}
            />
          </div>
        </div>
        {open && !limitReached && (
          <div
            id={listId}
            role="listbox"
            className="absolute z-40 mt-2 max-h-56 w-full overflow-auto rounded-lg border border-[#626880] bg-[#292c3c] p-1.5 shadow-xl"
          >
            {results.length ? results.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected="false"
                className={cn(
                  'flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-[#c6d0f5] hover:bg-[#414559] focus:bg-[#414559] focus:outline-none',
                  index === 0 && 'bg-[#414559]/60',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(option.value)}
              >
                {option.label}
              </button>
            )) : (
              <p className="px-3 py-3 text-sm text-[#838ba7]">{emptyText}</p>
            )}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-[#a5adce]">{hint}</p>}
    </div>
  );
}
