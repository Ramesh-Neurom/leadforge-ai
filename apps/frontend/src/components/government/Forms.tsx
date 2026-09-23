'use client';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select, LabeledField } from '@/components/ui/Field';
import { RecordValues, label } from '@/lib/government';
export interface FormField {
  name: string;
  label?: string;
  type?: string;
  options?: string[];
  required?: boolean;
}
export function RecordForm({
  fields,
  initial = {},
  onSave,
  submit = 'Save',
  disabled = false,
}: {
  fields: FormField[];
  initial?: RecordValues;
  onSave: (values: RecordValues) => Promise<unknown>;
  submit?: string;
  disabled?: boolean;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values: RecordValues = {};
    for (const f of fields) {
      const value = String(form.get(f.name) ?? '').trim();
      values[f.name] =
        value === ''
          ? null
          : f.type === 'number'
            ? Number(value)
            : f.type === 'datetime-local'
              ? new Date(value).toISOString()
              : value;
    }
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await onSave(values);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => {
          const value = initial[f.name];
          const display =
            f.type === 'datetime-local' && typeof value === 'string'
              ? new Date(
                  new Date(value).getTime() -
                    new Date(value).getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : value == null
                ? ''
                : String(value);
          return (
            <LabeledField
              key={f.name}
              label={f.label ?? label(f.name.replace(/([A-Z])/g, ' $1'))}
              className={f.type === 'textarea' ? 'md:col-span-2' : ''}
            >
              {f.options ? (
                <Select
                  name={f.name}
                  defaultValue={display}
                  required={f.required}
                  disabled={disabled}
                >
                  <option value="">Select / unknown</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {label(o)}
                    </option>
                  ))}
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea
                  name={f.name}
                  defaultValue={display}
                  rows={5}
                  disabled={disabled}
                />
              ) : (
                <Input
                  name={f.name}
                  type={f.type ?? 'text'}
                  defaultValue={display}
                  required={f.required}
                  min={f.type === 'number' ? 0 : undefined}
                  step={f.type === 'number' ? 'any' : undefined}
                  disabled={disabled}
                />
              )}
            </LabeledField>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={busy || disabled}>
        {busy ? 'Saving…' : submit}
      </Button>
    </form>
  );
}
export function Upload({
  onUpload,
  disabled = false,
}: {
  onUpload: (file: File) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium">
        Upload document
        <Input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
          disabled={busy || disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError('');
            try {
              await onUpload(file);
              e.target.value = '';
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Upload failed');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">Uploading and extracting…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
