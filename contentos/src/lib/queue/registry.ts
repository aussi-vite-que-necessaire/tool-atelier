import type { Queue } from 'bullmq';
import { dummyQueue, publishLinkedinQueue } from './client';

export const queueRegistry: Record<string, Queue> = {
  dummy: dummyQueue,
  'publish-linkedin': publishLinkedinQueue,
};

export type QueueName = keyof typeof queueRegistry;
