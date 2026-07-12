import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoiceService } from './voice.service';
import * as WebSocket from 'ws';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceGateway.name);

  @WebSocketServer()
  server: Server;

  // Map to store Gemini Multimodal Live API WebSocket connections per client socket ID
  private geminiConnections = new Map<string, WebSocket.WebSocket>();

  private geminiApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly voiceService: VoiceService,
  ) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY', '');
  }

  /**
   * Handle new WebSocket client connection from Next.js layout
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    if (!this.geminiApiKey) {
      this.logger.error('GEMINI_API_KEY is not defined in backend configuration.');
      client.disconnect();
      return;
    }

    // Connect securely to Google Gemini Multimodal Live API
    this.connectToGeminiLive(client);
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.closeGeminiConnection(client.id);
  }

  /**
   * Proxies raw microphone PCM (16kHz, 16-bit mono) chunks to Gemini Live
   */
  @SubscribeMessage('audio-chunk')
  handleAudioChunk(client: Socket, payload: Buffer) {
    const geminiWs = this.geminiConnections.get(client.id);
    
    if (geminiWs && geminiWs.readyState === WebSocket.WebSocket.OPEN) {
      // Send realtimeInput package to Gemini
      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm',
              data: payload.toString('base64'),
            },
          ],
        },
      };
      geminiWs.send(JSON.stringify(message));
    }
  }

  /**
   * Establishes BidiGenerateContent WebSocket with Gemini and binds event listeners
   */
  private connectToGeminiLive(client: Socket) {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.geminiApiKey}`;
    
    try {
      const geminiWs = new WebSocket.WebSocket(url);

      geminiWs.on('open', () => {
        this.logger.log(`Gemini Live WebSocket opened for client: ${client.id}`);

        // Send Setup message immediately after socket is established
        const setupMessage = {
          setup: {
            model: 'models/gemini-2.5-flash-native-audio-latest',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck', // 'Puck' is a high quality conversational voice
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: this.voiceService.getSystemInstruction() }],
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: 'routeToPage',
                    description: 'Navigate the user to a page on the website. Use this for logins, registrations, profile reviews, or portal entries.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        path: {
                          type: 'STRING',
                          description: 'The URL path to navigate to. E.g., /register, /login, /profile',
                        },
                      },
                      required: ['path'],
                    },
                  },
                  {
                    name: 'scrollToSection',
                    description: 'Scroll the viewport to a specific content section on the home page.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        elementId: {
                          type: 'STRING',
                          description: 'The DOM target element ID. E.g., #courses, #team, #about, #co-founder, #hero',
                        },
                      },
                      required: ['elementId'],
                    },
                  },
                ],
              },
            ],
          },
        };

        geminiWs.send(JSON.stringify(setupMessage));

        // Immediately trigger spoken greeting after setup completes
        setTimeout(() => {
          if (geminiWs.readyState === WebSocket.WebSocket.OPEN) {
            const greetingMessage = {
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: "Introduce yourself exactly with this Roman Urdu greeting phrase: 'Assalam o alikum ma haider hun ma apki madad kesy kr sakta hun, how can i help you today'. Speak warmly."
                      }
                    ]
                  }
                ],
                turnComplete: true
              }
            };
            geminiWs.send(JSON.stringify(greetingMessage));
          }
        }, 500);
      });

      geminiWs.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);

          // 1. Process server voice/text contents
          if (message.serverContent) {
            const { modelTurn, turnComplete, interrupted } = message.serverContent;

            // Handle client interruption (user spoke over model output)
            if (interrupted) {
              this.logger.log(`Gemini Live API: User interruption triggered for ${client.id}`);
              client.emit('interrupted');
            }

            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                // If it is streaming audio chunk (PCM 24kHz)
                if (part.inlineData && part.inlineData.data) {
                  client.emit('audio-chunk', { base64PCM: part.inlineData.data });
                }
                
                // If it is streaming text transcripts
                if (part.text) {
                  client.emit('agent-text', { text: part.text });
                }
              }
            }

            if (turnComplete) {
              client.emit('turn-complete');
            }
          }

          // 2. Process Gemini tool / function call executions
          if (message.toolCall && message.toolCall.functionCalls) {
            const responses: any[] = [];

            for (const call of message.toolCall.functionCalls) {
              this.logger.log(`Gemini tool call invoked: "${call.name}" with args: ${JSON.stringify(call.args)}`);
              
              if (call.name === 'routeToPage') {
                client.emit('action', { type: 'route', path: call.args.path });
              } else if (call.name === 'scrollToSection') {
                client.emit('action', { type: 'scroll', elementId: call.args.elementId });
              }

              // Build response context to tell Gemini the action was fired successfully
              responses.push({
                response: { output: { success: true } },
                id: call.id,
              });
            }

            // Immediately send back tool response to keep Gemini's conversation loop active
            if (geminiWs.readyState === WebSocket.WebSocket.OPEN) {
              const responsePayload = {
                toolResponse: {
                  functionResponses: responses,
                },
              };
              geminiWs.send(JSON.stringify(responsePayload));
            }
          }
        } catch (err) {
          this.logger.error(`Error parsing message from Gemini: ${err.message}`);
        }
      });

      geminiWs.on('close', (code, reason) => {
        this.logger.warn(`Gemini Live WebSocket closed for client: ${client.id}. Code: ${code}, Reason: ${reason.toString()}`);
        this.geminiConnections.delete(client.id);
      });

      geminiWs.on('error', (err) => {
        this.logger.error(`Gemini Live WebSocket error for client ${client.id}: ${err.message}`);
      });

      this.geminiConnections.set(client.id, geminiWs);
    } catch (error) {
      this.logger.error(`Failed to initiate Gemini Live WebSockets: ${error.message}`);
    }
  }

  private closeGeminiConnection(clientId: string) {
    const geminiWs = this.geminiConnections.get(clientId);
    if (geminiWs) {
      if (geminiWs.readyState === WebSocket.WebSocket.OPEN) {
        geminiWs.close();
      }
      this.geminiConnections.delete(clientId);
    }
  }
}
