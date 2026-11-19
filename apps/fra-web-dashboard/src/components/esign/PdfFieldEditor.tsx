import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Signer, SigningDocument, SigningField } from '@/lib/esign';
GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  pdf: Blob;
  pages: SigningDocument['pages'];
  signers: Signer[];
  fields: SigningField[];
  onChange: (fields: SigningField[]) => void;
}
export default function PdfFieldEditor({ pdf, pages, signers, fields, onChange }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(0);
  const [recipient, setRecipient] = useState(signers[0]?.id ?? '');
  const [kind, setKind] = useState<SigningField['kind']>('signature');
  const [selected, setSelected] = useState<number | null>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState('');
  const size = pages[page];
  useEffect(() => {
    let stopped = false;
    let task: ReturnType<typeof getDocument> | undefined;
    let render: RenderTask | undefined;
    setRendered(false);
    setError('');
    void (async () => {
      try {
        const bytes = new Uint8Array(await pdf.arrayBuffer());
        if (stopped) return;
        task = getDocument({ data: bytes, isEvalSupported: false });
        const doc = await task.promise;
        const p = await doc.getPage(page + 1);
        if (stopped || !canvas.current) return;
        const viewport = p.getViewport({
          scale: Math.min(1.5, 1400 / Math.max(size.width, size.height)),
        });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = p.render({ canvas: canvas.current, viewport });
        await render.promise;
        if (!stopped) setRendered(true);
      } catch {
        if (!stopped)
          setError(
            'Preview could not be rendered. Download the prepared PDF to review it; you can still place fields using the controls.'
          );
      }
    })();
    return () => {
      stopped = true;
      render?.cancel();
      void task?.destroy();
    };
  }, [pdf, page, size.width, size.height]);
  const add = (x = 35, y = 60) => {
    if (!recipient || fields.length >= 200) return;
    const width = Math.min(180, size.width),
      height = Math.min(44, size.height);
    if (width < 40 || height < 20) {
      setError('This page is too small for a signature field.');
      return;
    }
    onChange([
      ...fields,
      {
        signerId: recipient,
        page,
        kind,
        x: Math.max(0, Math.min(Math.round(x * 10) / 10, size.width - width)),
        y: Math.max(0, Math.min(Math.round(y * 10) / 10, size.height - height)),
        width,
        height,
      },
    ]);
    setSelected(fields.length);
  };
  const update = (key: 'x' | 'y' | 'width' | 'height', value: number) => {
    if (selected === null) return;
    onChange(fields.map((f, i) => (i === selected ? { ...f, [key]: value } : f)));
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 rounded-xl border bg-slate-100 p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
              setSelected(null);
            }}
          >
            Previous page
          </Button>
          <span className="text-sm">
            {page + 1} / {pages.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === pages.length - 1}
            onClick={() => {
              setPage(page + 1);
              setSelected(null);
            }}
          >
            Next page
          </Button>
        </div>
        {!rendered && !error && (
          <p role="status" className="mb-3 text-sm">
            Preparing document preview…
          </p>
        )}
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div
          className="relative mx-auto w-full max-w-[760px] bg-white shadow-sm"
          style={{ aspectRatio: `${size.width}/${size.height}` }}
        >
          <canvas
            ref={canvas}
            data-preview-ready={rendered}
            className="absolute inset-0 h-full w-full"
            aria-label={`PDF preview, page ${page + 1}`}
          />
          <button
            type="button"
            className="absolute inset-0 cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Place field on page; alternatively use Add field and position controls"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              add(
                ((event.clientX - box.left) / box.width) * size.width,
                ((event.clientY - box.top) / box.height) * size.height
              );
            }}
          />
          {fields.map(
            (field, index) =>
              field.page === page && (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelected(index)}
                  aria-pressed={selected === index}
                  className={`absolute overflow-hidden rounded border-2 px-1 text-left text-[10px] font-semibold sm:text-xs ${selected === index ? 'border-blue-700 bg-blue-100 text-blue-950' : 'border-teal-600 bg-teal-50/90 text-teal-950'}`}
                  style={{
                    left: `${(field.x / size.width) * 100}%`,
                    top: `${(field.y / size.height) * 100}%`,
                    width: `${(field.width / size.width) * 100}%`,
                    height: `${(field.height / size.height) * 100}%`,
                  }}
                >
                  {field.kind}
                  <span className="block truncate font-normal">
                    {signers.find((s) => s.id === field.signerId)?.name}
                  </span>
                </button>
              )
          )}
        </div>
        <p className="mt-4 text-xs text-slate-600">
          Click the page to place a field, or use Add field and the position controls. Coordinates
          start at the top-left.
        </p>
      </div>
      <aside className="space-y-5">
        <div>
          <Label htmlFor="field-recipient">Recipient</Label>
          <select
            id="field-recipient"
            className="mt-1 h-10 w-full rounded-md border bg-background px-2"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          >
            {signers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="field-kind">Field type</Label>
          <select
            id="field-kind"
            className="mt-1 h-10 w-full rounded-md border bg-background px-2"
            value={kind}
            onChange={(e) => setKind(e.target.value as SigningField['kind'])}
          >
            <option value="signature">Signature</option>
            <option value="name">Full name</option>
            <option value="date">Date signed</option>
          </select>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => add()}
          disabled={!recipient || fields.length >= 200}
        >
          Add field
        </Button>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Fields ({fields.length})</h3>
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Each recipient needs a signature field.</p>
          )}
          {fields.map((f, i) => (
            <button
              type="button"
              key={i}
              aria-pressed={selected === i}
              className={`block w-full rounded-md border p-2 text-left text-xs ${selected === i ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => {
                setPage(f.page);
                setSelected(i);
              }}
            >
              {i + 1}. {f.kind} · Page {f.page + 1}
              <span className="block truncate text-muted-foreground">
                {signers.find((s) => s.id === f.signerId)?.name}
              </span>
            </button>
          ))}
        </div>
        {selected !== null && fields[selected] && (
          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Selected field position</legend>
            <p className="text-xs text-muted-foreground">
              Page size: {Math.round(size.width)} × {Math.round(size.height)} points.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map((key) => (
                <div key={key}>
                  <Label htmlFor={`field-${key}`}>{key.toUpperCase()}</Label>
                  <Input
                    id={`field-${key}`}
                    type="number"
                    min={key === 'width' ? 40 : key === 'height' ? 20 : 0}
                    step="1"
                    value={fields[selected][key]}
                    onChange={(e) => update(key, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onChange(fields.filter((_, i) => i !== selected));
                setSelected(null);
              }}
            >
              Remove field
            </Button>
          </fieldset>
        )}
      </aside>
    </div>
  );
}
