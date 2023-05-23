'use client';

import useAudioStore, {
  getReadyToRecord,
  updateListening,
  addStreamingTranscription,
  getTranscriptPrompt,
  setFullTranscription,
  setTranscribingFull,
  setTranscribingStream,
  addTrailingTranscription,
} from '@/store/audio';
// import useWhisper from '@hrishioa/use-whisper';
import { useWhisper } from '../../../use-whisper/lib/useWhisper';
import { useEffect, useRef } from 'react';
import { TRANSCRIBE_TIME_SLICES } from '@/utils/constants';

// Component specifically for Whisper

export default function Whisper() {
  // console.log('Whisper rerendered');

  const transcriptionPrompt = useRef(
    getTranscriptPrompt(useAudioStore.getState().streamingTranscriptions)
  );

  const trailingTranscriptions = useRef(
    useAudioStore.getState().trailingTranscriptions
  );

  useEffect(
    () =>
      useAudioStore.subscribe(
        (state) =>
          (transcriptionPrompt.current = getTranscriptPrompt(
            state.streamingTranscriptions
          ))
      ),
    []
  );

  useEffect(
    () =>
      useAudioStore.subscribe(
        (state) =>
          (trailingTranscriptions.current = state.trailingTranscriptions)
      ),
    []
  );

  const onTranscribe = async (blob: Blob) => {
    setTranscribingFull(true);

    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const body = JSON.stringify({
      file: base64,
      model: 'whisper-1',
    });
    const headers = { 'Content-Type': 'application/json' };
    try {
      const response = await fetch('/audio', {
        method: 'POST',
        body,
        headers,
      });

      const res = await response.json();
      console.log('Got full transcription - ', res);
      if (res.text) {
        setFullTranscription(res.text);
      }

      setTranscribingFull(false);

      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log('Failed to transcribe', error);
      return {
        blob,
        text: undefined,
      };
    }
  };

  const onTrailingTranscribe = async (blob: Blob) => {
    console.log('Starting trailing transcription for blob of size ', blob.size);

    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    const body = JSON.stringify({
      file: base64,
      model: 'whisper-1',
      prompt: trailingTranscriptions.current[
        trailingTranscriptions.current.length - TRANSCRIBE_TIME_SLICES
      ]
        ? trailingTranscriptions.current[
            trailingTranscriptions.current.length - TRANSCRIBE_TIME_SLICES
          ]
        : undefined,
    });
    const headers = { 'Content-Type': 'application/json' };
    try {
      const response = await fetch('/audio', {
        method: 'POST',
        body,
        headers,
      });

      const res = await response.json();
      if (res.text) {
        console.log(
          'Potential prompt - ',
          trailingTranscriptions.current[
            trailingTranscriptions.current.length - TRANSCRIBE_TIME_SLICES
          ]
        );
        console.log('Trailing transcription - ', res.text);
        addTrailingTranscription(res.text);
      }
    } catch (error) {
      console.log('Failed to stream transcribe', error);
    }
  };

  const onStreamTranscribe = async (blob: Blob) => {
    setTranscribingStream(true);
    // console.log('Stream transcription for ', blob);
    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    // console.log(
    //   'Transcribing new chunk while the existing transcription set is ',
    //   transcriptionPrompt.current
    // );
    const body = JSON.stringify({
      file: base64,
      model: 'whisper-1',
      prompt: transcriptionPrompt.current,
    });
    const headers = { 'Content-Type': 'application/json' };
    try {
      const response = await fetch('/audio', {
        method: 'POST',
        body,
        headers,
      });
      const res = await response.json();
      if (res.text) {
        // console.log('Streamed transcription received - ', res);
        addStreamingTranscription(res.text);
      }
      setTranscribingStream(false);
      return {
        blob,
        text: res.text,
      };
    } catch (error) {
      console.log('Failed to stream transcribe', error);
      return {
        blob,
        text: undefined,
      };
    }
  };

  const { startRecording, stopRecording, recording, pauseRecording } =
    useWhisper({
      streaming: true,
      timeSlice: 2_000, // seconds
      // concatChunk: true,
      removeSilence: true,
      onTranscribe,
      onStreamTranscribe,
      onTrailingTranscribe,
      // showLogs: true,
      autoTranscribe: true,
      trailingTranscribeTimeSlices: TRANSCRIBE_TIME_SLICES,
      silenceBufferThreshold: 2_500,
    });

  useEffect(() => {
    console.log('record functions changed');
    getReadyToRecord(startRecording, stopRecording, pauseRecording);
  }, [startRecording, stopRecording, pauseRecording]);

  useEffect(() => {
    console.log('Recording changed to ', recording);
    updateListening(recording);
  }, [recording]);

  return <></>;
}
