"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, Trash2, AudioLines } from "lucide-react";
import { useSpeechToText } from "@/lib/use-speech-to-text";

const MAX_SECONDS = 180;
const LANGS = [
  { code: "en-KE", label: "English" },
  { code: "sw-KE", label: "Kiswahili" },
];

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
};

/**
 * Two ways to say it instead of typing it:
 *  - Dictate: speak and the words are typed into the description.
 *  - Voice note: record up to three minutes and attach the audio to the report.
 * Both are optional, for people who find typing hard, are short of airtime for a
 * long message, or simply find it easier to talk.
 */
export function VoiceInput({
  defaultLang = "en-KE",
  onText,
  onRecording,
  canAttach,
}: {
  defaultLang?: string;
  /** Called with each finished sentence of dictation. */
  onText: (text: string) => void;
  /** Called with the recorded audio, or null when it is removed. */
  onRecording: (blob: Blob | null) => void;
  /** Voice notes cannot be saved while offline. */
  canAttach: boolean;
}) {
  const [lang, setLang] = useState(defaultLang);
  const stt = useSpeechToText({ lang, onFinal: onText });

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    cleanupStream();
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const startRecording = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      // 24 kbps is plenty for speech and keeps a three-minute note around 500 KB, which matters on poor data.
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24_000 });
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        cleanupStream();
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
        setRecording(false);
        if (blob.size > 0) { setUrl(URL.createObjectURL(blob)); onRecording(blob); }
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) recRef.current?.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setRecError("Microphone access was blocked. Allow it in your browser settings, or type instead.");
      cleanupStream();
    }
  };

  const stopRecording = () => { try { recRef.current?.stop(); } catch { /* already stopped */ } };
  const clear = () => { setUrl(null); onRecording(null); };

  const canRecord = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (!stt.isSupported && !canRecord) return null;

  return (
    <div className="rounded-xl border border-line bg-paper/60 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {stt.isSupported && (
          <>
            <button
              type="button"
              onClick={stt.listening ? stt.stop : stt.start}
              aria-pressed={stt.listening}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${stt.listening ? "border-rose-300 bg-rose-50 text-rose-700" : "border-line bg-surface text-ink hover:bg-purple-050"}`}
            >
              {stt.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {stt.listening ? "Stop dictating" : "Speak instead of typing"}
            </button>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={stt.listening}
              aria-label="Language you will speak"
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold"
            >
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </>
        )}
        {canRecord && canAttach && !url && (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${recording ? "border-rose-300 bg-rose-50 text-rose-700" : "border-line bg-surface text-ink hover:bg-purple-050"}`}
          >
            {recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <AudioLines className="h-3.5 w-3.5" />}
            {recording ? `Stop · ${mm}:${ss}` : "Record a voice note"}
          </button>
        )}
      </div>

      {stt.listening && (
        <p className="min-h-5 text-sm italic text-muted" aria-live="polite">
          {stt.interim || "Listening… speak now."}
        </p>
      )}
      {stt.error && <p role="alert" className="text-xs text-rose-600">{stt.error}</p>}
      {recError && <p role="alert" className="text-xs text-rose-600">{recError}</p>}

      {url && (
        <div className="flex items-center gap-2">
          <audio src={url} controls className="h-9 min-w-0 flex-1" />
          <button type="button" onClick={clear} aria-label="Remove voice note" className="text-muted hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted">
        {stt.isSupported && "Speaking to type uses your browser's speech service, so the audio may be sent to its maker to be turned into text. "}
        {canAttach && "A voice note is saved with your report and only the response team can hear it. "}
        Prefer not to? Typing works just as well.
      </p>
    </div>
  );
}
