"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const noop = () => () => {};
const ctor = (): any =>
  typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

/**
 * Dictation with the browser's own speech recognition.
 *
 * Note for anyone changing this: in most browsers the audio is sent to the
 * browser vendor's speech service to be transcribed. It does not pass through
 * our servers, but it does leave the device, which is why the voice input says
 * so before it is used.
 */
export function useSpeechToText({ lang, onFinal }: { lang: string; onFinal: (text: string) => void }) {
  const isSupported = useSyncExternalStore(noop, () => !!ctor(), () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const finalRef = useRef(onFinal);

  useEffect(() => { finalRef.current = onFinal; }, [onFinal]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
  }, []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return;
    setError(null);
    setInterim("");
    const rec = new C();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e: any) => {
      setError(e?.error === "not-allowed" ? "Microphone access was blocked." : e?.error === "no-speech" ? "Nothing was heard." : "Dictation stopped. You can type instead.");
      setListening(false);
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [lang]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* gone */ } }, []);

  return { isSupported, listening, interim, error, start, stop };
}
