"use client";

import { useActionState, useEffect, useState } from "react";
import type { MediaRecord } from "@/lib/media/types";
import { editAction, deleteMediaAction } from "./actions";

// Les médias raster (image/render) sont agrandissables et éditables par IA.
function isRaster(kind: MediaRecord["kind"]): boolean {
  return kind === "image" || kind === "render";
}

export function GalleryGrid({ items }: { items: MediaRecord[] }) {
  const [enlarged, setEnlarged] = useState<MediaRecord | null>(null);
  const [toDelete, setToDelete] = useState<MediaRecord | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Aucun média pour l&apos;instant.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="border border-gray-200 rounded overflow-hidden flex flex-col"
          >
            {/* Aperçu */}
            <div className="bg-gray-50 flex items-center justify-center h-40 overflow-hidden">
              {isRaster(item.kind) && (
                <button
                  type="button"
                  onClick={() => setEnlarged(item)}
                  className="w-full h-full"
                  title="Agrandir"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.prompt ?? item.id}
                    className="w-full h-full object-contain cursor-zoom-in"
                  />
                </button>
              )}
              {item.kind === "video" && (
                <video src={item.url} controls className="w-full h-full object-contain" />
              )}
              {item.kind === "pdf" && (
                <div className="flex flex-col items-center gap-1 p-2 text-center">
                  <span className="text-3xl">📄</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ouvrir le PDF
                  </a>
                </div>
              )}
            </div>

            {/* Métadonnées + suppression */}
            <div className="p-2 space-y-1 flex flex-col flex-1">
              <div className="text-xs text-gray-500 space-y-0.5">
                <div>
                  <span className="font-medium text-gray-700">{item.kind}</span>
                </div>
                {item.width && item.height && (
                  <div>
                    {item.width}&times;{item.height}
                  </div>
                )}
                <div className="font-mono text-gray-400 truncate" title={item.id}>
                  {item.id}
                </div>
              </div>
              <div className="mt-auto pt-1">
                <button
                  type="button"
                  onClick={() => setToDelete(item)}
                  className="text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-0.5"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {enlarged && (
        <EnlargeModal item={enlarged} onClose={() => setEnlarged(null)} />
      )}
      {toDelete && (
        <DeleteConfirmModal item={toDelete} onClose={() => setToDelete(null)} />
      )}
    </>
  );
}

// Conteneur de modale : fond sombre, panneau centré, fermeture au clic extérieur et sur Échap.
function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded shadow-lg max-w-3xl w-full max-h-[90vh] overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Agrandissement + édition IA en chaîne : chaque édition crée une variante et bascule l'affichage dessus.
function EnlargeModal({
  item,
  onClose,
}: {
  item: MediaRecord;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState({ id: item.id, url: item.url });
  const [state, action, pending] = useActionState(editAction, {});

  useEffect(() => {
    if (state.id && state.url) {
      setCurrent({ id: state.id, url: state.url });
    }
  }, [state.id, state.url]);

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="font-mono text-xs text-gray-400 truncate" title={current.id}>
          {current.id}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-lg leading-none"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt="Image agrandie"
        className="max-w-full max-h-[55vh] mx-auto border border-gray-200 rounded"
      />

      <form action={action} className="mt-4 space-y-2">
        <input type="hidden" name="sourceId" value={current.id} />
        <label className="block text-sm font-medium">Éditer avec l&apos;IA</label>
        <textarea
          key={current.id}
          name="prompt"
          required
          rows={2}
          placeholder="Décris la modification : ajoute…, change…, retire…"
          className="block w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "Édition…" : "Éditer avec l'IA"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </Modal>
  );
}

// Confirmation oui/non avant suppression.
function DeleteConfirmModal({
  item,
  onClose,
}: {
  item: MediaRecord;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const fd = new FormData();
    fd.set("id", item.id);
    await deleteMediaAction(fd);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <p className="text-sm">Supprimer ce média ? Cette action est définitive.</p>
      <p className="font-mono text-xs text-gray-400 mt-1 truncate" title={item.id}>
        {item.id}
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
        >
          Non
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="bg-red-600 text-white text-sm rounded px-3 py-1.5 hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Suppression…" : "Oui, supprimer"}
        </button>
      </div>
    </Modal>
  );
}
