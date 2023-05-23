'use strict';

const defaultStopTimeout = 5e3;
const ffmpegCoreUrl = "https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js";
const silenceRemoveCommand = "silenceremove=start_periods=1:stop_periods=-1:start_threshold=-30dB:stop_threshold=-30dB:start_silence=2:stop_silence=2";
const whisperApiEndpoint = "https://api.openai.com/v1/audio/";
const silenceThreshold = 255;

exports.defaultStopTimeout = defaultStopTimeout;
exports.ffmpegCoreUrl = ffmpegCoreUrl;
exports.silenceRemoveCommand = silenceRemoveCommand;
exports.silenceThreshold = silenceThreshold;
exports.whisperApiEndpoint = whisperApiEndpoint;
