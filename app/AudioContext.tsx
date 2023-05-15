"use client";
import { createContext, useReducer } from "react";

type AudioContextState = {
  transcribed: string[];
};
type AudioContextDispatch = {
  dispatch: React.Dispatch<AudioContextActions>;
};

export const AudioContext = createContext(
  {} as AudioContextState & AudioContextDispatch
);
const initialState: AudioContextState = { transcribed: [] };

type AudioContextActions =
  | { type: "UPDATE_TRANSCRIPTION"; payload: string }
  | { type: "SET_TRANSCRIPTION"; payload: string[] };

const reducer = (state: AudioContextState, action: AudioContextActions) => {
  switch (action.type) {
    case "UPDATE_TRANSCRIPTION":
      return {
        ...state,
        transcribed: [...state.transcribed, action.payload],
      };
    case "SET_TRANSCRIPTION":
      return {
        ...state,
        transcribed: action.payload,
      };
    default:
      return state;
  }
};

function AudioContextProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AudioContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AudioContext.Provider>
  );
}

export default AudioContextProvider;
