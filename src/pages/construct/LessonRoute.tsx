import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { Lesson } from './types';
import { getLesson } from './lessons';
import { loadProgress, recordDownload, type ProgramProgress } from './storage';
import { DownloadSequence } from './DownloadSequence';
import { LessonView } from './LessonView';

function LessonFlow({ lesson }: { lesson: Lesson }) {
  const [phase, setPhase] = useState<'downloading' | 'reading'>('downloading');
  const [progress, setProgress] = useState<ProgramProgress | undefined>(
    () => loadProgress().programs[lesson.id],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  if (phase === 'downloading') {
    return (
      <DownloadSequence
        lesson={lesson}
        onComplete={() => {
          const updated = recordDownload(lesson.id);
          setProgress(updated.programs[lesson.id]);
          setPhase('reading');
        }}
      />
    );
  }
  return <LessonView lesson={lesson} progress={progress} />;
}

/** /construct/:programId — download gate, then the article. */
export function LessonRoute() {
  const { programId } = useParams();
  const lesson = programId ? getLesson(programId) : undefined;
  if (!lesson) return <Navigate to="/construct" replace />;
  // Key by id so navigating between lessons restarts the flow cleanly.
  return <LessonFlow key={lesson.id} lesson={lesson} />;
}
