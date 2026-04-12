import * as ort from "onnxruntime-node";
import { join } from "path";
import { ensureOrtBackend } from "./ort-backend-fix";
import { convertToFloat32PCM } from "./audio";
import { isLangIdOnnxCached, getLangIdOnnxDir } from "./lang-id-install";

export const MAX_LANG_ID_SAMPLES = 160000; // 10s at 16kHz

export interface LangDetectResult {
  code: string;
  confidence: number;
}

let session: ort.InferenceSession | null = null;
let labelList: string[] | null = null;

export function pickTopLanguage(probs: Float32Array, labels: string[]): LangDetectResult {
  let maxIdx = 0;
  let maxVal = probs[0];

  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > maxVal) {
      maxVal = probs[i];
      maxIdx = i;
    }
  }

  return {
    code: labels[maxIdx],
    confidence: maxVal,
  };
}

export async function detectAudioLanguageOnnx(
  audioPath: string,
  modelDir?: string,
): Promise<LangDetectResult | null> {
  const dir = modelDir ?? getLangIdOnnxDir();

  if (!isLangIdOnnxCached(dir)) {
    return null;
  }

  if (!session || !labelList) {
    ensureOrtBackend();
    session = await ort.InferenceSession.create(join(dir, "lang-id-ecapa.onnx"));
    labelList = await Bun.file(join(dir, "labels.json")).json();
  }

  const allSamples = await convertToFloat32PCM(audioPath);
  const samples =
    allSamples.length > MAX_LANG_ID_SAMPLES
      ? allSamples.slice(0, MAX_LANG_ID_SAMPLES)
      : allSamples;

  const inputTensor = new ort.Tensor("float32", samples, [1, samples.length]);

  const results = await session.run({ waveform: inputTensor });

  const probsData = results["language_probs"].data as Float32Array;
  // Use .slice() — Bun doesn't support subarray views as ONNX tensor data
  const probs = probsData.slice();

  return pickTopLanguage(probs, labelList!);
}
