'use client';

import {
  getTranscriptionForGroup,
  storeIsReadyForNew,
  useTranscribeStore,
} from '@/store/transcribe';
import { startVersion, useWritingStore } from '@/store/write';
import { useEffect, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { WritingVersion } from './WritingVersion';

const DEFAULT_VERSION_GROUP = 1; // Just hardcoding for now, we can do more when we do multiple groups

export function WritingContainer() {
  const [lastProcessedTranscriptionGroup, setLastProcessedTranscriptionGroup] =
    useState<number>(-1); // Don't actually use this value, other than the incremented version because of the -1

  // Not sure if we should move this selector to the store
  const { nextTranscriptionGroup, nextFullTranscript } = useTranscribeStore(
    (state) => {
      const nextTranscription = getTranscriptionForGroup(
        state,
        lastProcessedTranscriptionGroup + 1
      );

      if (
        nextTranscription.fullTranscription &&
        !nextTranscription.active &&
        !nextTranscription.pendingJobs &&
        (nextTranscription.groupId - state.currentTranscriptionGroup > 1 ||
          storeIsReadyForNew(state))
      )
        return {
          nextTranscriptionGroup: nextTranscription.groupId,
          nextFullTranscript: nextTranscription.fullTranscription,
        };

      return {
        nextTranscriptionGroup: null,
        nextFullTranscript: null,
      };
    }
  );

  // TODO: this component should be considered deeply when rehydrating persisted state, fyi.

  // This useEffect is really all you need to push jobs from transcripts to the store.
  useEffect(() => {
    if (
      nextTranscriptionGroup !== null &&
      nextFullTranscript !== null &&
      nextTranscriptionGroup > lastProcessedTranscriptionGroup
    ) {
      console.log('Setting last processed to ', nextTranscriptionGroup);
      setLastProcessedTranscriptionGroup(nextTranscriptionGroup);

      startVersion(nextFullTranscript, DEFAULT_VERSION_GROUP);
    }
    // Disabling because we want to reduce re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextTranscriptionGroup, lastProcessedTranscriptionGroup]);

  const versionIds = useWritingStore(
    (state) => state.versions.map((version) => version.startedAt),
    shallow
  );

  return (
    <div className="h-full flex flex-row">
      <h1 className="text-lg font-bold flex justify-between items-center h-11">
        <span className="uppercase">Writer</span>
      </h1>
      <div className="flex flex-row">
        {versionIds.map((versionId) => (
          <WritingVersion key={versionId} versionId={versionId} />
        ))}
      </div>
    </div>
  );
}
