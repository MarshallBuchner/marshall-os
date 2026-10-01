/** Voice adapters — browser-local only; never pretends to be cloud STT/TTS */

export type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
  isFinal: boolean;
};

export type SttStatus = "unsupported" | "idle" | "listening" | "error";

export type TtsStatus = "unsupported" | "idle" | "speaking" | "muted";

export interface SpeechToTextAdapter {
  readonly available: boolean;
  start(): Promise<void>;
  stop(): void;
  abort(): void;
  onResult: ((r: SpeechRecognitionResult) => void) | null;
  onEnd: (() => void) | null;
  onError: ((message: string) => void) | null;
}

export interface TextToSpeechAdapter {
  readonly available: boolean;
  muted: boolean;
  speak(text: string): Promise<void>;
  stop(): void;
  setMuted(muted: boolean): void;
}
