"use client";

import { useMemo, useState, useTransition } from "react";
import { addImage, removeAt, moveUp, moveDown } from "./order";
import { composePdfAction, type ComposePdfResult } from "./actions";

export type PickerImage = { id: string; url: string };

export function Composer({ images }: { images: PickerImage[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [result, setResult] = useState<ComposePdfResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const urlById = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of images) map.set(img.id, img.url);
    return map;
  }, [images]);

  const positionById = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [selected]);

  function build() {
    setResult(null);
    startTransition(async () => {
      const res = await composePdfAction(selected, tags);
      setResult(res);
      if (res.ok) {
        setSelected([]);
        setTags("");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Galerie cliquable */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">
          Galerie{" "}
          <span className="text-gray-400 font-normal">({images.length})</span>
        </h2>
        {images.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune image PNG/JPEG dans la galerie.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((img) => {
              const pos = positionById.get(img.id);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelected((s) => addImage(s, img.id))}
                  disabled={pos !== undefined}
                  className={`relative border rounded overflow-hidden h-24 bg-gray-50 ${
                    pos !== undefined
                      ? "border-gray-800 cursor-default"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  title={pos !== undefined ? `Page ${pos}` : "Ajouter au PDF"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.id} className="w-full h-full object-contain" />
                  {pos !== undefined && (
                    <span className="absolute top-1 left-1 bg-gray-800 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {pos}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Composition du PDF */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">
          PDF{" "}
          <span className="text-gray-400 font-normal">
            ({selected.length} page{selected.length !== 1 ? "s" : ""})
          </span>
        </h2>

        {selected.length === 0 ? (
          <p className="text-sm text-gray-400">
            Clique des images à gauche pour les ajouter, dans l&apos;ordre voulu.
          </p>
        ) : (
          <ol className="space-y-2">
            {selected.map((id, i) => (
              <li
                key={id}
                className="flex items-center gap-3 border border-gray-200 rounded p-2"
              >
                <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                <div className="h-12 w-12 shrink-0 bg-gray-50 rounded overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlById.get(id)}
                    alt={id}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-mono text-xs text-gray-400 truncate flex-1" title={id}>
                  {id}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSelected((s) => moveUp(s, i))}
                    disabled={i === 0}
                    className="text-gray-500 hover:text-gray-800 disabled:opacity-30 px-1"
                    title="Monter"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => moveDown(s, i))}
                    disabled={i === selected.length - 1}
                    className="text-gray-500 hover:text-gray-800 disabled:opacity-30 px-1"
                    title="Descendre"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => removeAt(s, i))}
                    className="text-red-600 hover:text-red-800 px-1"
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-1">
          <label htmlFor="pdf-tags" className="block text-xs text-gray-500">
            Tags (optionnel, séparés par des virgules)
          </label>
          <input
            id="pdf-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="brochure, client-x"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          />
        </div>

        <button
          type="button"
          onClick={build}
          disabled={selected.length === 0 || isPending}
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700 disabled:opacity-40"
        >
          {isPending ? "Construction…" : "Construire le PDF"}
        </button>

        {result?.ok && (
          <div className="border border-green-200 bg-green-50 rounded p-3 text-sm space-y-1">
            <p className="text-green-800">PDF créé.</p>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Ouvrir le PDF
            </a>
          </div>
        )}
        {result && !result.ok && (
          <p className="border border-red-200 bg-red-50 rounded p-3 text-sm text-red-700">
            {result.error}
          </p>
        )}
      </div>
    </div>
  );
}
