import Bull, { Queue, Job } from 'bull';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  redis: {
    host: process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
    port: parseInt(process.env.REDIS_URL?.split(':')[2] || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
};

// Queue definitions
export const aiGenerationQueue: Queue = new Bull('ai-generation', redisConfig);
export const leadScoringQueue: Queue = new Bull('lead-scoring', redisConfig);
export const emailQueue: Queue = new Bull('email', redisConfig);
export const transcriptionQueue: Queue = new Bull('transcription', redisConfig);

// AI Generation Job Processor
aiGenerationQueue.process(3, async (job: Job) => {
  console.log(`Processing AI generation job ${job.id}:`, job.data);
  
  // Job data structure:
  // {
  //   type: 'builder-upload' | 'user-customization',
  //   userId?: string,
  //   propertyId?: string,
  //   designAssetId?: string,
  //   prompt?: string,
  //   images?: string[],
  //   model: 'Marble 0.1-plus' | 'Marble 0.1-mini'
  // }
  
  // Implementation will be added in later tasks
  return { status: 'queued', jobId: job.id };
});

// Lead Scoring Job Processor
leadScoringQueue.process(5, async (job: Job) => {
  console.log(`Processing lead scoring job ${job.id}:`, job.data);
  
  // Job data structure:
  // {
  //   userId: string,
  //   propertyId: string,
  //   eventType: 'VIEW' | 'SAVE' | 'DESIGN' | 'CALL',
  //   callId?: string
  // }
  
  // Implementation will be added in later tasks
  return { status: 'processed', jobId: job.id };
});

// Transcription Job Processor
transcriptionQueue.process(2, async (job: Job) => {
  console.log(`Processing transcription job ${job.id}:`, job.data);
  
  // Job data structure:
  // {
  //   callId: string,
  //   recordingUrl: string
  // }
  
  // Implementation will be added in later tasks
  return { status: 'transcribed', jobId: job.id };
});

// Email Job Processor
emailQueue.process(10, async (job: Job) => {
  console.log(`Processing email job ${job.id}:`, job.data);
  
  // Job data structure:
  // {
  //   to: string,
  //   subject: string,
  //   body: string,
  //   template?: string
  // }
  
  // Implementation will be added in later tasks
  return { status: 'sent', jobId: job.id };
});

// Queue event handlers
const setupQueueEvents = (queue: Queue, name: string) => {
  queue.on('completed', (job: Job) => {
    console.log(`${name} job ${job.id} completed`);
  });

  queue.on('failed', (job: Job, err: Error) => {
    console.error(`${name} job ${job.id} failed:`, err);
  });

  queue.on('stalled', (job: Job) => {
    console.warn(`${name} job ${job.id} stalled`);
  });
};

setupQueueEvents(aiGenerationQueue, 'AI Generation');
setupQueueEvents(leadScoringQueue, 'Lead Scoring');
setupQueueEvents(transcriptionQueue, 'Transcription');
setupQueueEvents(emailQueue, 'Email');

export default {
  aiGenerationQueue,
  leadScoringQueue,
  emailQueue,
  transcriptionQueue,
};
