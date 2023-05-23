'use strict';

var reactHooksAsync = require('@chengsokdara/react-hooks-async');
var react = require('react');
var configs = require('./configs');
var helpers = require('./helpers');

const defaultConfig = {
  apiKey: "",
  autoStart: false,
  autoTranscribe: true,
  mode: "transcriptions",
  nonStop: false,
  removeSilence: false,
  stopTimeout: configs.defaultStopTimeout,
  streaming: false,
  concatChunk: false,
  timeSlice: 1e3,
  onDataAvailable: void 0,
  onTranscribe: void 0,
  onStreamTranscribe: void 0,
  onTrailingTranscribe: void 0,
  showLogs: false,
  silenceBufferThreshold: configs.silenceThreshold
};
const defaultTimeout = {
  stop: void 0
};
const defaultTranscript = {
  blob: void 0,
  text: void 0
};
const useWhisper = (config) => {
  const {
    apiKey,
    autoStart,
    autoTranscribe,
    mode,
    nonStop,
    removeSilence,
    stopTimeout,
    streaming,
    concatChunk,
    timeSlice,
    whisperConfig,
    trailingTranscribeTimeSlices,
    onTrailingTranscribe: onTrailingTranscribeCallback,
    onDataAvailable: onDataAvailableCallback,
    onTranscribe: onTranscribeCallback,
    onStreamTranscribe: onStreamTranscribeCallback,
    showLogs,
    silenceBufferThreshold
  } = {
    ...defaultConfig,
    ...config
  };
  if (!apiKey && !onTranscribeCallback) {
    throw new Error("apiKey is required if onTranscribe is not provided");
  }
  const chunks = react.useRef([]);
  const trailingChunks = react.useRef([]);
  const encoder = react.useRef();
  const listener = react.useRef();
  const recorder = react.useRef();
  const stream = react.useRef();
  const timeout = react.useRef(defaultTimeout);
  const [recording, setRecording] = react.useState(false);
  const [speaking, setSpeaking] = react.useState(false);
  const [transcribing, setTranscribing] = react.useState(false);
  const [transcript, setTranscript] = react.useState(defaultTranscript);
  react.useEffect(() => {
    return () => {
      if (chunks.current) {
        chunks.current = [];
      }
      if (trailingChunks.current.length)
        trailingChunks.current = [];
      if (encoder.current) {
        encoder.current.flush();
        encoder.current = void 0;
      }
      if (recorder.current) {
        recorder.current.destroy();
        recorder.current = void 0;
      }
      onStopTimeout("stop");
      if (listener.current) {
        listener.current.off("speaking", onStartSpeaking);
        listener.current.off("stopped_speaking", onStopSpeaking);
      }
      if (stream.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        stream.current = void 0;
      }
    };
  }, []);
  reactHooksAsync.useEffectAsync(async () => {
    if (autoStart) {
      await onStartRecording();
    }
  }, [autoStart]);
  const startRecording = async () => {
    await onStartRecording();
  };
  const pauseRecording = async () => {
    await onPauseRecording();
  };
  const stopRecording = async () => {
    await onStopRecording();
  };
  const onStartRecording = async () => {
    try {
      if (!stream.current) {
        await onStartStreaming();
      }
      if (stream.current) {
        if (!recorder.current) {
          const {
            default: { RecordRTCPromisesHandler, StereoAudioRecorder }
          } = await import('recordrtc');
          const recorderConfig = {
            mimeType: "audio/wav",
            numberOfAudioChannels: 1,
            // mono
            recorderType: StereoAudioRecorder,
            sampleRate: 44100,
            // Sample rate = 44.1khz
            timeSlice: streaming ? timeSlice : void 0,
            type: "audio",
            ondataavailable: autoTranscribe && streaming ? onDataAvailable : void 0,
            disableLogs: !showLogs
          };
          console.log("recorderConfig", recorderConfig);
          recorder.current = new RecordRTCPromisesHandler(
            stream.current,
            recorderConfig
          );
        }
        if (!encoder.current) {
          const { Mp3Encoder } = await import('lamejs');
          encoder.current = new Mp3Encoder(1, 44100, 96);
        }
        const recordState = await recorder.current.getState();
        if (recordState === "inactive" || recordState === "stopped") {
          await recorder.current.startRecording();
        }
        if (recordState === "paused") {
          await recorder.current.resumeRecording();
        }
        if (nonStop) {
          onStartTimeout("stop");
        }
        setRecording(true);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const onStartStreaming = async () => {
    try {
      if (stream.current) {
        stream.current.getTracks().forEach((track) => track.stop());
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      if (!listener.current) {
        const { default: hark } = await import('hark');
        listener.current = hark(stream.current, {
          interval: 100,
          play: false
        });
        listener.current.on("speaking", onStartSpeaking);
        listener.current.on("stopped_speaking", onStopSpeaking);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const onStartTimeout = (type) => {
    if (!timeout.current[type]) {
      timeout.current[type] = setTimeout(onStopRecording, stopTimeout);
    }
  };
  const onStartSpeaking = () => {
    showLogs && console.log("start speaking");
    setSpeaking(true);
    onStopTimeout("stop");
  };
  const onStopSpeaking = () => {
    showLogs && console.log("stop speaking");
    setSpeaking(false);
    if (nonStop) {
      onStartTimeout("stop");
    }
  };
  const onPauseRecording = async () => {
    try {
      if (recorder.current) {
        const recordState = await recorder.current.getState();
        if (recordState === "recording") {
          await recorder.current.pauseRecording();
        }
        onStopTimeout("stop");
        setRecording(false);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const onStopRecording = async () => {
    try {
      if (recorder.current) {
        const recordState = await recorder.current.getState();
        if (recordState === "recording" || recordState === "paused") {
          await recorder.current.stopRecording();
        }
        onStopStreaming();
        onStopTimeout("stop");
        setRecording(false);
        if (autoTranscribe) {
          await onTranscribing();
        } else {
          const blob = await recorder.current.getBlob();
          setTranscript({
            blob
          });
        }
        await recorder.current.destroy();
        chunks.current = [];
        if (encoder.current) {
          encoder.current.flush();
          encoder.current = void 0;
        }
        recorder.current = void 0;
      }
    } catch (err) {
      console.error(err);
    }
  };
  const onStopStreaming = () => {
    if (listener.current) {
      setSpeaking(false);
      listener.current.off("speaking", onStartSpeaking);
      listener.current.off("stopped_speaking", onStopSpeaking);
      listener.current = void 0;
    }
    if (stream.current) {
      stream.current.getTracks().forEach((track) => track.stop());
      stream.current = void 0;
    }
  };
  const onStopTimeout = (type) => {
    if (timeout.current[type]) {
      clearTimeout(timeout.current[type]);
      timeout.current[type] = void 0;
    }
  };
  const onTranscribing = async () => {
    showLogs && console.log("transcribing speech");
    try {
      if (encoder.current && recorder.current) {
        const recordState = await recorder.current.getState();
        if (recordState === "stopped") {
          setTranscribing(true);
          let blob = await recorder.current.getBlob();
          if (removeSilence) {
            const silencedBlob = await helpers.removeSilenceWithFfmpeg({
              showLogs,
              blob,
              threshold: silenceBufferThreshold || configs.silenceThreshold
            });
            if (!silencedBlob) {
              setTranscript({
                blob
              });
              setTranscribing(false);
            } else {
              blob = silencedBlob;
            }
          } else {
            const buffer = await blob.arrayBuffer();
            showLogs && console.log({ wav: buffer.byteLength });
            const mp3 = encoder.current.encodeBuffer(new Int16Array(buffer));
            blob = new Blob([mp3], { type: "audio/mpeg" });
            showLogs && console.log({ blob, mp3: mp3.byteLength });
          }
          if (typeof onTranscribeCallback === "function") {
            const transcribed = await onTranscribeCallback(blob);
            showLogs && console.log("onTranscribe", transcribed);
            setTranscript(transcribed);
          } else {
            const file = new File([blob], "speech.mp3", { type: "audio/mpeg" });
            const text = await onWhispered(file);
            showLogs && console.log("onTranscribing", { text });
            setTranscript({
              blob,
              text
            });
          }
          setTranscribing(false);
        }
      }
    } catch (err) {
      console.info(err);
      setTranscribing(false);
    }
  };
  const onDataAvailable = async (data) => {
    showLogs && console.log("onDataAvailable", data);
    try {
      if (streaming && recorder.current) {
        onDataAvailableCallback?.(data);
        if (encoder.current) {
          const buffer = await data.arrayBuffer();
          const mp3chunk = encoder.current.encodeBuffer(new Int16Array(buffer));
          const mp3blob = new Blob([mp3chunk], { type: "audio/mpeg" });
          if (trailingTranscribeTimeSlices && typeof onTrailingTranscribeCallback === "function") {
            trailingChunks.current.push(mp3blob);
            console.log("Collected ", trailingChunks.current.length, " chunks");
            if (trailingChunks.current.length > trailingTranscribeTimeSlices)
              trailingChunks.current = trailingChunks.current.slice(
                -trailingTranscribeTimeSlices
              );
            if (trailingChunks.current.length >= trailingTranscribeTimeSlices) {
              const joinedBlob = new Blob(trailingChunks.current, {
                type: "audio/mpeg"
              });
              if (removeSilence) {
                helpers.removeSilenceWithFfmpeg({
                  showLogs,
                  blob: joinedBlob,
                  threshold: silenceBufferThreshold || configs.silenceThreshold
                }).then((silencedBlob) => {
                  if (silencedBlob)
                    onTrailingTranscribeCallback(silencedBlob);
                });
              } else {
                onTrailingTranscribeCallback(joinedBlob);
              }
            }
          }
          if (concatChunk) {
            chunks.current.push(mp3blob);
          } else {
            chunks.current = [mp3blob];
          }
        }
        const recorderState = await recorder.current.getState();
        if (recorderState === "recording") {
          let blob = new Blob(chunks.current, {
            type: "audio/mpeg"
          });
          if (removeSilence) {
            showLogs && console.log("Removing silence.");
            const silencedBlob = await helpers.removeSilenceWithFfmpeg({
              showLogs,
              blob,
              threshold: silenceBufferThreshold || configs.silenceThreshold
            });
            if (!silencedBlob)
              return;
            blob = silencedBlob;
          }
          if (typeof onStreamTranscribeCallback === "function") {
            onStreamTranscribeCallback(blob);
          } else {
            const file = new File([blob], "speech.mp3", {
              type: "audio/mpeg"
            });
            const text = await onWhispered(file);
            showLogs && console.log("onInterim", { text });
            if (text) {
              setTranscript((prev) => ({ ...prev, text }));
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };
  const onWhispered = reactHooksAsync.useMemoAsync(
    async (file) => {
      const body = new FormData();
      body.append("file", file);
      body.append("model", "whisper-1");
      if (mode === "transcriptions") {
        body.append("language", whisperConfig?.language ?? "en");
      }
      if (whisperConfig?.prompt) {
        body.append("prompt", whisperConfig.prompt);
      }
      if (whisperConfig?.response_format) {
        body.append("response_format", whisperConfig.response_format);
      }
      if (whisperConfig?.temperature) {
        body.append("temperature", `${whisperConfig.temperature}`);
      }
      const headers = {};
      headers["Content-Type"] = "multipart/form-data";
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      const { default: axios } = await import('axios');
      const response = await axios.post(configs.whisperApiEndpoint + mode, body, {
        headers
      });
      return response.data.text;
    },
    [apiKey, mode, whisperConfig]
  );
  return {
    recording,
    speaking,
    transcribing,
    transcript,
    pauseRecording,
    startRecording,
    stopRecording
  };
};

exports.useWhisper = useWhisper;
