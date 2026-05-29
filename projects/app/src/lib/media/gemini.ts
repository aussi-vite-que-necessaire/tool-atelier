import { GoogleGenAI } from '@google/genai';
import { base64ToBytes, bytesToBase64 } from './base64';
import { config } from './config';

const MODEL = 'gemini-3-pro-image-preview';

export interface GeminiImageResult {
  bytes: Uint8Array;
  mimeType: string;
}

export async function generateImage(prompt: string, aspectRatio: string): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey() });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio },
    } as Record<string, unknown>,
  });
  return extractImage(response);
}

export async function editImage(
  sourceBytes: Uint8Array,
  sourceMime: string,
  editPrompt: string,
): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey() });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: editPrompt },
      { inlineData: { mimeType: sourceMime, data: bytesToBase64(sourceBytes) } },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as Record<string, unknown>,
  });
  return extractImage(response);
}

interface GeminiPart {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
}

function extractImage(response: unknown): GeminiImageResult {
  const parts =
    (response as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })?.candidates?.[0]
      ?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        bytes: base64ToBytes(part.inlineData.data),
        mimeType: part.inlineData.mimeType ?? 'image/png',
      };
    }
  }
  throw new Error("Gemini n'a renvoyé aucune image (réponse texte seule ou vide).");
}
