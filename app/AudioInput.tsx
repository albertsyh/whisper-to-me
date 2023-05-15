"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useWhisper } from "@albertsyh/use-whisper";

import AudioContextProvider, { AudioContext } from "./AudioContext";

function AudioInputHandler() {
  const count = useRef(0);
  const textPrompt = useRef("");
  const { transcribed, dispatch } = useContext(AudioContext);
  const [finalText, setFinalText] = useState<string>("");

  useEffect(() => {
    textPrompt.current = transcribed.join(" ");
  }, [transcribed]);

  const onTranscribe = async (blob: Blob) => {
    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const body = JSON.stringify({
      file: base64,
      model: "whisper-1",
    });
    const headers = { "Content-Type": "application/json" };
    try {
      const response = await fetch("/audio", {
        method: "POST",
        body,
        headers,
      });

      const res = await response.json();
      setFinalText(res.text);
      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log("Failed to transcribe", error);
      return {
        blob,
        text: undefined,
      };
    }
  };

  const onStreamTranscribe = async (blob: Blob) => {
    console.log("Stream transcription");
    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const body = JSON.stringify({
      file: base64,
      model: "whisper-1",
      prompt: textPrompt.current,
    });
    const headers = { "Content-Type": "application/json" };
    try {
      const response = await fetch("/audio", {
        method: "POST",
        body,
        headers,
      });

      const res = await response.json();
      if (res.text) {
        dispatch({ type: "UPDATE_TRANSCRIPTION", payload: res.text });
      }
      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log("Failed to stream transcribe", error);
      return {
        blob,
        text: undefined,
      };
    }
  };

  const { startRecording, stopRecording, recording } = useWhisper({
    streaming: true,
    timeSlice: 1_000, // 2 second
    removeSilence: true,
    onTranscribe,
    onStreamTranscribe,
    // showLogs: true,
  });

  const handleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  return (
    <div className="flex py-3 flex-col items-start gap-y-4">
      <div className="flex flex-row w-full gap-x-4">
        <div className="w-full h-96 bg-slate-100 rounded-lg p-3">
          <h2 className="text-sm font-bold">Real-time</h2>
          <div className="text-slate-700">{transcribed.join(" ")}</div>
        </div>
        <div className="w-full h-96 bg-slate-100 rounded-lg p-3">
          <h2 className="text-sm font-bold">Final</h2>
          <div className="text-slate-700">{finalText}</div>
        </div>
      </div>
      <button
        className="bg-blue-500 text-slate-200 px-3 py-2 rounded"
        onClick={handleRecording}
      >
        {recording ? "stop" : "start"}
      </button>
    </div>
  );
}

function AudioInput() {
  return (
    <AudioContextProvider>
      <AudioInputHandler />
    </AudioContextProvider>
  );
}

export default AudioInput;
