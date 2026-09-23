import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  LiveClientMessage,
  LiveServerMessage,
} from '@meeting-assistant/shared-types';
import { sessionService } from '../services/session';
import {
  azureSpeechStreamingService,
  ISpeechStreamingSession,
} from '../services/azure/speechStreamingService';
import { logger } from '../utils/logger';

interface ActiveClientState {
  ws: WebSocket;
  sessionId: string;
  speechSession: ISpeechStreamingSession | null;
  isStopping: boolean;
}

export function setupLiveMeetingWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/api/sessions/live-stream',
  });

  logger.info('WebSocket live streaming server mounted at /api/sessions/live-stream', {}, 'LiveMeetingWS');

  wss.on('error', (err) => {
    logger.error('WebSocket server error', { error: err.message }, 'LiveMeetingWS');
  });

  // Azure App Service 30s heartbeat to prevent idle connection timeouts
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch (pingErr) {
          logger.warn('Error sending WebSocket heartbeat ping', { error: pingErr }, 'LiveMeetingWS');
        }
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info('Live meeting WebSocket client connected', { clientIp }, 'LiveMeetingWS');

    let clientState: ActiveClientState | null = null;

    ws.on('pong', () => {
      // Keepalive acknowledged
    });

    const sendMessage = (msg: LiveServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(msg));
        } catch (sendErr) {
          logger.warn('Failed to send WebSocket message to client', { error: sendErr }, 'LiveMeetingWS');
        }
      }
    };

    ws.on('message', async (data, isBinary) => {
      try {
        // Binary message: continuous PCM audio frame
        if (isBinary) {
          if (clientState?.speechSession && clientState.speechSession.isActive()) {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            clientState.speechSession.writeAudio(buffer);
          }
          return;
        }

        // Text message: control command (start, stop, ping, transcript)
        const text = data.toString('utf-8');
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          sendMessage({
            type: 'error',
            error: { code: 'INVALID_JSON', message: 'Malformed JSON control message.' },
          });
          return;
        }

        const action = parsed.action || parsed.type;

        if (action === 'ping') {
          sendMessage({ type: 'pong' });
          return;
        }

        // Handle client-side transcript segment (from Web Speech API or tab audio recognizer)
        if (action === 'client_transcript_segment' || action === 'transcript_segment' || action === 'transcript_chunk') {
          const segText = (parsed.text || parsed.transcript || '').trim();
          if (segText && clientState) {
            try {
              const result = await sessionService.addLiveTranscriptSegment(
                clientState.sessionId,
                segText,
                parsed.durationSeconds || 4
              );
              sendMessage({
                type: 'final_transcript',
                sessionId: clientState.sessionId,
                chunk: result.chunk,
                accumulatedTranscript: result.accumulatedTranscript,
                latestAnalysis: result.latestAnalysis,
                savedMemoriesCount: result.savedMemoriesCount,
              });
            } catch (addErr) {
              logger.error('Failed saving client transcript segment', {
                sessionId: clientState.sessionId,
                error: addErr,
              }, 'LiveMeetingWS');
            }
          }
          return;
        }

        if (action === 'client_interim_transcript' || action === 'interim_transcript') {
          if (clientState && parsed.interimText) {
            sendMessage({
              type: 'interim_transcript',
              sessionId: clientState.sessionId,
              interimText: parsed.interimText,
            });
          }
          return;
        }

        if (action === 'start' || action === 'start_session') {
          if (clientState) {
            sendMessage({
              type: 'error',
              error: { code: 'ALREADY_STARTED', message: 'A meeting session is already active on this connection.' },
            });
            return;
          }

          let session = parsed.sessionId ? sessionService.getSession(parsed.sessionId) : null;
          if (!session) {
            session = sessionService.createSession(parsed.title || 'Live Meeting');
          }

          const sessionId = session.id;

          // Start Azure AI Speech continuous streaming session with requested language (e.g. 'hi-IN' or 'en-US')
          const language = parsed.language || 'en-US';
          let speechSession: ISpeechStreamingSession | null = null;
          try {
            speechSession = await azureSpeechStreamingService.startSession({
              onInterim: (interimText: string) => {
                sendMessage({
                  type: 'interim_transcript',
                  sessionId,
                  interimText,
                });
              },
              onFinal: async (finalText: string, durationSeconds?: number) => {
                try {
                  const result = await sessionService.addLiveTranscriptSegment(
                    sessionId,
                    finalText,
                    durationSeconds
                  );
                  sendMessage({
                    type: 'final_transcript',
                    sessionId,
                    chunk: result.chunk,
                    accumulatedTranscript: result.accumulatedTranscript,
                    latestAnalysis: result.latestAnalysis,
                    savedMemoriesCount: result.savedMemoriesCount,
                  });
                } catch (addErr) {
                  logger.error('Failed saving live transcript segment', {
                    sessionId,
                    error: addErr,
                  }, 'LiveMeetingWS');
                }
              },
              onError: (error: Error) => {
                logger.warn('Azure Speech stream error in session', {
                  sessionId,
                  error: error.message,
                }, 'LiveMeetingWS');
              },
              onClose: () => {
                logger.info('Speech recognition engine closed stream', { sessionId }, 'LiveMeetingWS');
              },
            }, language);
          } catch (speechErr) {
            const errMsg = speechErr instanceof Error ? speechErr.message : String(speechErr);
            logger.warn('Azure Speech streaming init skipped or failed (will use client recognition fallback): ' + errMsg, {}, 'LiveMeetingWS');
          }

          clientState = {
            ws,
            sessionId,
            speechSession,
            isStopping: false,
          };

          sendMessage({
            type: 'session_started',
            sessionId,
            session,
          });
          return;
        }

        if (action === 'stop' || action === 'stop_session') {
          if (!clientState) {
            sendMessage({
              type: 'error',
              error: { code: 'NO_ACTIVE_SESSION', message: 'No active session to stop.' },
            });
            return;
          }

          await cleanupSession(clientState);
          clientState = null;
        }
      } catch (err) {
        logger.error('Unhandled WebSocket message error', {
          error: err instanceof Error ? err.message : String(err),
        }, 'LiveMeetingWS');
        sendMessage({
          type: 'error',
          error: {
            code: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Internal streaming error',
          },
        });
      }
    });

    const cleanupSession = async (state: ActiveClientState) => {
      if (state.isStopping) return;
      state.isStopping = true;

      logger.info('Stopping live meeting streaming session', {
        sessionId: state.sessionId,
      }, 'LiveMeetingWS');

      // Stop speech recognition engine
      if (state.speechSession) {
        try {
          await state.speechSession.stop();
        } catch (stopErr) {
          logger.warn('Error stopping speech recognizer', { error: stopErr }, 'LiveMeetingWS');
        }
        state.speechSession = null;
      }

      // Finalize session in SessionService (runs final analysis & memory persistence)
      try {
        const finalizedSession = await sessionService.endSession(state.sessionId);
        sendMessage({
          type: 'session_completed',
          sessionId: state.sessionId,
          session: finalizedSession,
        });
      } catch (endErr) {
        logger.warn('Error ending session in SessionService', { error: endErr }, 'LiveMeetingWS');
      }
    };

    ws.on('close', async (code, reason) => {
      logger.info('Live meeting WebSocket client closed connection', { clientIp, code, reason: reason?.toString() }, 'LiveMeetingWS');
      if (clientState) {
        try {
          await cleanupSession(clientState);
        } catch (closeErr) {
          logger.warn('Error during WebSocket client disconnect cleanup', { error: closeErr }, 'LiveMeetingWS');
        } finally {
          clientState = null;
        }
      }
    });

    ws.on('error', (err) => {
      logger.warn('WebSocket client connection error', { error: err.message }, 'LiveMeetingWS');
    });
  });

  return wss;
}
