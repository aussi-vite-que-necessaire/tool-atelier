import type { Queue } from 'bullmq';
import { dummyQueue, generateImageQueue, publishLinkedinQueue, renderVisualQueue } from './client';

export const queueRegistry: Record<string, Queue> = {
  dummy: dummyQueue,
  'render-visual': renderVisualQueue,
  'generate-image': generateImageQueue,
  'publish-linkedin': publishLinkedinQueue,
};

export type QueueName = keyof typeof queueRegistry;
