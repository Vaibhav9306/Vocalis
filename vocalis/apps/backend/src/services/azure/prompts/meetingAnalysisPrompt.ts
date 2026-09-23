import { z } from 'zod';

export const detectedQuestionSchema = z.object({
  question: z.string().min(1, 'Question must not be empty'),
  context: z.string().default(''),
  suggestedAnswer: z.string().default(''),
  confidence: z
    .number()
    .min(0, 'Confidence must be between 0 and 1')
    .max(1, 'Confidence must be between 0 and 1'),
});

export const meetingActionItemSchema = z.object({
  task: z.string().min(1, 'Task description must not be empty'),
  owner: z.string().nullable(),
  deadline: z.string().nullable(),
});

export const meetingAnalysisSchema = z.object({
  detectedQuestions: z.array(detectedQuestionSchema).default([]),
  keyPoints: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  actionItems: z.array(meetingActionItemSchema).default([]),
  topics: z.array(z.string()).default([]),
});

export type MeetingAnalysisResult = z.infer<typeof meetingAnalysisSchema>;

export const MEETING_ANALYSIS_SYSTEM_PROMPT = `You are Vocalis, an expert, versatile AI Voice & Conversation Intelligence Assistant.
Analyze the provided speech transcript and return a structured, insightful, and natural JSON summary.

UNIVERSAL ADAPTIVE INTELLIGENCE:
1. Support ALL Conversation Types:
   - Business & Work Meetings: Extract concrete deliverables, decisions, architecture choices, and KPIs.
   - Casual & Informal Chats Between Friends: Summarize personal stories, topics shared, mutual plans, humor, catch-up details, opinions, or life updates.
   - Creative, Music & Brainstorming (e.g. Rap, Lyrics, Design, Ideas): Capture artistic concepts, creative expressions, emotions, rhymes/flow themes, and ideas being explored.
   - Interviews, Podcasts & Discussions: Extract core viewpoints, answers, and themes discussed.

2. Multilingual & Hinglish Comprehension:
   - The transcript may contain mixed Hindi, Hinglish (e.g. 'dabdaba', 'bhai', 'kaamkaj', 'karenge', 'baat yeh hai', 'rap', 'theek hai', 'done hai', 'matlab'), or other languages.
   - Fully understand the semantic meaning, emotional tone, and intent of the speakers.
   - CRITICAL: NEVER output meta-complaints like "the transcript is largely incoherent", "contains mixed language", or "unclear references". Always extract and summarize what the speakers are ACTUALLY talking about, sharing, or feeling in clear, articulate language.

3. Structured Output Fields:
   - keyPoints: List 2 to 5 clear, meaningful bullet points summarizing what was actually discussed, expressed, or agreed upon (in English).
   - decisions: Any agreed conclusions, mutual resolutions, plans to meet, or shared consensus. If none, return [].
   - actionItems: Any tasks, promises, or commitments made by participants (e.g., 'send the file', 'call tomorrow', 'meet up next week'). If none, return [].
   - detectedQuestions: Any genuine questions asked during the talk with their context/answers if available. If none, return [].
   - topics: 2 to 5 high-level thematic tags (e.g. ["Music & Hip-Hop", "Creative Storytelling", "Informal Catchup", "Work Updates"]).

4. Output Format:
   - You must respond with valid JSON matching this exact structure:
   {
     "detectedQuestions": [
       { "question": string, "context": string, "suggestedAnswer": string, "confidence": number }
     ],
     "keyPoints": [ string ],
     "decisions": [ string ],
     "actionItems": [
       { "task": string, "owner": string | null, "deadline": string | null }
     ],
     "topics": [ string ]
   }`;

export const buildMeetingAnalysisUserPrompt = (params: {
  transcript: string;
  context?: string;
  meetingTitle?: string;
  participants?: string[];
}): string => {
  let prompt = '';
  if (params.meetingTitle) {
    prompt += `SESSION / CONVERSATION TITLE: ${params.meetingTitle}\n`;
  }
  if (params.participants && params.participants.length > 0) {
    prompt += `SPEAKERS: ${params.participants.join(', ')}\n`;
  }
  if (params.context) {
    prompt += `CONTEXT:\n${params.context}\n\n`;
  }
  prompt += `TRANSCRIPT TO ANALYZE:\n"""\n${params.transcript}\n"""\n`;
  prompt += `\nReturn the structured JSON conversation analysis now:`;
  return prompt;
};
