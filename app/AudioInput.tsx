'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useWhisper } from '@albertsyh/use-whisper';

import AudioContextProvider, { AudioContext } from './AudioContext';

function AudioInputHandler() {
  const textPrompt = useRef('');
  const { transcribed, dispatch } = useContext(AudioContext);
  const [finalText, setFinalText] = useState<string>('');
  const [draftedEmail, setDraftedEmail] = useState<string>('');
  const [draftingEmail, setDraftingEmail] = useState<boolean>(false);

  useEffect(() => {
    textPrompt.current = transcribed.join(' ');
  }, [transcribed]);

  const onTranscribe = async (blob: Blob) => {
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
      setFinalText(res.text);
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

  useEffect(() => {
    (async () => {
      if (finalText !== '') {
        console.log('Trying out GPT with new transcription ', finalText);
        try {
          setDraftedEmail('');
          setDraftingEmail(true);

          const response = await fetch('/gpt/draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transcription: finalText,
            }),
          });

          if (!response.ok) console.error('Error - ', response.statusText);

          const data = response.body;

          if (!data) {
            console.error('No data returned');
            return;
          }

          const reader = data.getReader();
          const decoder = new TextDecoder();

          let done = false;
          setDraftingEmail(false);
          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;

            console.log('Got chunk - ', decoder.decode(value));
            setDraftedEmail((email) => email + decoder.decode(value));
          }
          console.log('Completed!');
        } catch (error) {
          console.log('Failed to get GPT response ', error);
        }
      }
    })().catch((err) => {
      console.error('Error in useEffect for processing transcript ', err);
    });
  }, [finalText]);

  const onStreamTranscribe = async (blob: Blob) => {
    console.log('Stream transcription');
    const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    const body = JSON.stringify({
      file: base64,
      model: 'whisper-1',
      prompt: textPrompt.current,
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
        dispatch({ type: 'UPDATE_TRANSCRIPTION', payload: res.text });
      }
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

  const { startRecording, stopRecording, recording } = useWhisper({
    streaming: true,
    timeSlice: 5_000, // seconds
    removeSilence: true,
    onTranscribe,
    onStreamTranscribe,
    silenceBufferThreshold: 25_000,
  });

  const handleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  const handleRestart = useCallback(() => {
    setFinalText('');
    dispatch({ type: 'SET_TRANSCRIPTION', payload: [] });
    textPrompt.current = '';
  }, []); // eslint-disable-line

  return (
    <div className="flex py-3 flex-col items-start gap-y-4">
      <div
        className="flex flex-row w-full gap-x-4"
        style={{ minHeight: '400px' }}
      >
        <div className="w-full bg-slate-100 rounded-lg p-3">
          <h2 className="text-sm font-bold">Real-time</h2>
          <div className="h-fit text-slate-700 overflow-y-auto whitespace-break-spaces break-all max-h-96">
            {transcribed.join(' ')}
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-lg p-3">
          <h2 className="text-sm font-bold">Final</h2>
          <div className="h-fit text-slate-700 overflow-y-auto whitespace-break-spaces break-all max-h-96">
            {finalText}
          </div>
        </div>
      </div>
      <div className="flex justify-between w-full">
        <button
          className="bg-slate-500 text-slate-200 px-3 py-2 rounded"
          onClick={handleRestart}
        >
          restart
        </button>
        <button
          className="bg-blue-500 text-slate-200 px-3 py-2 rounded"
          onClick={handleRecording}
        >
          {recording ? 'stop' : 'start'}
        </button>
      </div>
      {draftingEmail || draftedEmail !== '' ? (
        <div className="flex justify-between w-full">
          <div className="w-full bg-slate-100 rounded-lg p-3">
            <h2 className="text-sm font-bold">Drafted Email</h2>
            <div className="h-fit text-slate-700 overflow-y-auto whitespace-break-spaces break-all max-h-96">
              {draftedEmail !== '' ? draftedEmail : 'Drafting Email...'}
            </div>
          </div>
        </div>
      ) : null}
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
