import type { Lesson } from '../types';
import { lessonZero } from './lesson-zero';
import { kungFu } from './kung-fu';
import { jiuJitsu } from './jiu-jitsu';
import { deepWork } from './deep-work';
import { habitArchitecture } from './habit-architecture';

/** Library order. Adding a lesson = one data file + one entry here. */
export const LESSONS: Lesson[] = [lessonZero, kungFu, jiuJitsu, deepWork, habitArchitecture];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
