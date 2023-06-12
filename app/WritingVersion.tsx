import { useWritingStore } from '@/store/write';
import { useEffect, useState, memo } from 'react';

export const WritingVersion = memo(function WritingVersion({
  versionId,
}: {
  versionId: number;
}) {
  const [started, setStarted] = useState(false);

  const versionReadyToStart = useWritingStore((state) =>
    state.versions.find((v) => v.startedAt === versionId)
  );

  useEffect(() => {
    console.log(
      'Version ',
      versionId,
      ' ready to start - ',
      versionReadyToStart
    );
  }, [versionId, versionReadyToStart]);

  return (
    (started && (
      <div key={versionId} className="flex flex-col">
        Version {versionId}
      </div>
    )) ||
    null
  );
});
