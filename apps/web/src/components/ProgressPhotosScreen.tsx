import type { ProgressPhoto, ProgressPhotoList } from '@torkout/contracts';
import { useEffect, useState, type ChangeEvent } from 'react';

import { photoPoseLabel } from '../presentation';

export type ProgressPhotoPose = 'back' | 'front' | 'side';

export interface ProgressPhotoApi {
  contentUrl(id: string): string;
  list(): Promise<ProgressPhotoList>;
  remove(id: string): Promise<void>;
  upload(input: {
    contentType: string;
    data: string;
    heightPx?: number;
    localDate: string;
    notes?: string;
    pose: ProgressPhotoPose;
    widthPx?: number;
  }): Promise<ProgressPhoto>;
}

interface ProgressPhotosScreenProps {
  api: ProgressPhotoApi;
  onBack(): void;
  today: string;
}

const POSES: ProgressPhotoPose[] = ['front', 'side', 'back'];
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

/**
 * Comprime a imagem no dispositivo antes do envio quando o navegador oferece canvas; caso
 * contrário o arquivo original é enviado e a validação de tamanho continua valendo.
 */
async function compress(
  file: File,
): Promise<{ contentType: string; data: string; heightPx?: number; widthPx?: number }> {
  const original = await readAsDataUrl(file);
  const fallback = { contentType: file.type, data: original.split(',')[1] ?? '' };
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return fallback;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return fallback;
    context.drawImage(bitmap, 0, 0, width, height);
    const encoded = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    if (!encoded) return fallback;
    return { contentType: 'image/jpeg', data: encoded, heightPx: height, widthPx: width };
  } catch {
    return fallback;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(new Error('READ_FAILED')));
    reader.readAsDataURL(file);
  });
}

function measurementSummary(photo: ProgressPhoto): string | null {
  if (!photo.measurement) return null;
  const parts: string[] = [];
  if (photo.measurement.weightKg !== null) parts.push(`${photo.measurement.weightKg} kg`);
  if (photo.measurement.waistCm !== null) parts.push(`cintura ${photo.measurement.waistCm} cm`);
  if (photo.measurement.abdomenCm !== null) parts.push(`barriga ${photo.measurement.abdomenCm} cm`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function ProgressPhotosScreen({ api, onBack, today }: ProgressPhotosScreenProps) {
  const [items, setItems] = useState<ProgressPhoto[]>([]);
  const [guidance, setGuidance] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Carregando fotos…');
  const [loading, setLoading] = useState(true);
  const [pose, setPose] = useState<ProgressPhotoPose>('front');
  const [localDate, setLocalDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ProgressPhoto | null>(null);
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');

  const [reloadToken, setReloadToken] = useState(0);

  function refresh(): void {
    setReloadToken((token) => token + 1);
  }

  // A rota memoriza `api`, então o efeito só reexecuta quando a lista precisa ser recarregada.
  useEffect(() => {
    let active = true;
    api
      .list()
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setGuidance(page.guidance);
        setStatus(page.items.length === 0 ? 'Nenhuma foto registrada ainda.' : 'Fotos carregadas.');
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setStatus('Não foi possível carregar as fotos agora.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, reloadToken]);

  const ordered = [...items].sort((left, right) => left.localDate.localeCompare(right.localDate));
  const dates = [...new Set(ordered.map((item) => item.localDate))];
  const comparison =
    compareFrom && compareTo
      ? {
          from: ordered.filter((item) => item.localDate === compareFrom),
          to: ordered.filter((item) => item.localDate === compareTo),
        }
      : null;

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('Tamanho acima do permitido. Escolha uma imagem menor.');
      return;
    }
    setStatus('Preparando a imagem neste dispositivo…');
    try {
      const prepared = await compress(file);
      if ((prepared.data.length * 3) / 4 > MAX_UPLOAD_BYTES) {
        setError('Tamanho acima do permitido depois da compressão. Escolha uma imagem menor.');
        return;
      }
      await api.upload({
        contentType: prepared.contentType,
        data: prepared.data,
        localDate,
        pose,
        ...(prepared.widthPx ? { widthPx: prepared.widthPx } : {}),
        ...(prepared.heightPx ? { heightPx: prepared.heightPx } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setNotes('');
      setStatus('Foto salva na sua conta.');
      refresh();
    } catch {
      setError('Não foi possível salvar a foto agora.');
    } finally {
      event.target.value = '';
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    try {
      await api.remove(pendingDelete.id);
      setStatus('Foto excluída.');
      setPendingDelete(null);
      refresh();
    } catch {
      setError('Não foi possível excluir a foto agora.');
    }
  }

  return (
    <main className="photos-layout">
      <header className="planning-header">
        <div>
          <p className="eyebrow">Evolução visual</p>
          <h1>Fotos de evolução</h1>
          <p>
            As fotos ficam guardadas na sua conta e são visíveis somente você. Elas não possuem
            endereço público e nunca aparecem em relatórios.
          </p>
        </div>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </header>

      <p className="sync-note" role="status" aria-live="polite">
        {loading ? 'Carregando fotos…' : status}
      </p>
      {error && (
        <p className="safety-note" role="alert">
          {error}
        </p>
      )}

      <section className="card" aria-labelledby="photo-guidance-heading">
        <h2 id="photo-guidance-heading">Para comparar com sentido</h2>
        <ul>
          {guidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="photo-upload-heading">
        <h2 id="photo-upload-heading">Registrar foto</h2>
        <label>
          Data
          <input
            type="date"
            value={localDate}
            onChange={(event) => setLocalDate(event.target.value)}
          />
        </label>
        <label>
          Pose
          <select
            value={pose}
            onChange={(event) => setPose(event.target.value as ProgressPhotoPose)}
          >
            {POSES.map((item) => (
              <option key={item} value={item}>
                {photoPoseLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observações da foto
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label>
          Imagem
          <input
            accept={ACCEPTED_TYPES.join(',')}
            type="file"
            onChange={(event) => void handleFile(event)}
          />
          <span className="field-hint">
            JPEG, PNG ou WebP. A imagem é reduzida neste dispositivo antes do envio.
          </span>
        </label>
      </section>

      <section className="card" aria-labelledby="photo-timeline-heading">
        <h2 id="photo-timeline-heading">Linha do tempo</h2>
        {ordered.length === 0 ? (
          <p>Nenhuma foto registrada ainda.</p>
        ) : (
          <ul aria-label="Linha do tempo de fotos" className="photo-timeline">
            {ordered.map((item) => (
              <li key={item.id}>
                <figure>
                  <img
                    alt={`${photoPoseLabel(item.pose)} em ${item.localDate}`}
                    loading="lazy"
                    src={api.contentUrl(item.id)}
                  />
                  <figcaption>
                    <strong>{item.localDate}</strong> · {photoPoseLabel(item.pose)}
                    {measurementSummary(item) ? ` · ${measurementSummary(item)}` : ''}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </figcaption>
                </figure>
                <button type="button" onClick={() => setPendingDelete(item)}>
                  Excluir foto de {photoPoseLabel(item.pose)} em {item.localDate}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingDelete && (
        <section className="card" aria-labelledby="photo-delete-heading">
          <h2 id="photo-delete-heading">Excluir foto</h2>
          <p>
            A foto de {photoPoseLabel(pendingDelete.pose)} em {pendingDelete.localDate} será
            removida definitivamente.
          </p>
          <div className="button-row">
            <button className="danger" type="button" onClick={() => void confirmDelete()}>
              Confirmar exclusão
            </button>
            <button type="button" onClick={() => setPendingDelete(null)}>
              Cancelar exclusão
            </button>
          </div>
        </section>
      )}

      <section className="card" aria-label="Comparação entre datas">
        <h2>Comparar duas datas</h2>
        <label>
          Comparar de
          <select value={compareFrom} onChange={(event) => setCompareFrom(event.target.value)}>
            <option value="">Selecione a data inicial</option>
            {dates.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Comparar até
          <select value={compareTo} onChange={(event) => setCompareTo(event.target.value)}>
            <option value="">Selecione a data final</option>
            {dates.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {comparison === null ? (
          <p>Selecione duas datas para comparar.</p>
        ) : (
          <div className="photo-comparison">
            {[comparison.from, comparison.to].map((group, index) => (
              <div key={index === 0 ? compareFrom : compareTo}>
                <h3>{index === 0 ? compareFrom : compareTo}</h3>
                {group.length === 0 ? (
                  <p>Nenhuma foto nesta data.</p>
                ) : (
                  group.map((item) => (
                    <figure key={item.id}>
                      <img
                        alt={`${photoPoseLabel(item.pose)} em ${item.localDate}`}
                        loading="lazy"
                        src={api.contentUrl(item.id)}
                      />
                      <figcaption>{photoPoseLabel(item.pose)}</figcaption>
                    </figure>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
