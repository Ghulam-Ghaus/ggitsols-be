import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private geminiModel: any = null;
  private deepgramApiKey: string;

  constructor(private readonly configService: ConfigService) {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.deepgramApiKey = this.configService.get<string>('DEEPGRAM_API_KEY', '');

    if (geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(geminiApiKey);
      // Using gemini-1.5-flash for low latency and high quality
      this.geminiModel = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: `
          You are Haider, the friendly and professional AI Voice Assistant for GG IT Solutions.
          Your goal is to assist website visitors, students, teachers, and parents.
          
          GG IT Solutions offers professional IT courses and ERP/LMS solutions.
          
          Our Team & Leadership:
          1. Ghulam Ghaus: Co-Founder & CEO, Backend & AI Engineer. Expert in Python, Node.js, NestJS, FastAPI, Cloud, Microservices, and AI Agentic Pipelines. Contact: ghulamghaus266@gmail.com, +92 306 7956164 / +92 302 0655044.
          2. Saqib Javed: Co-Founder & COO, Operations & Academic Director. Manages operations, academic planning, partnerships, student career counseling. Contact: +92 302 0655044.
          3. Ali Raza: Software Engineer. Expert in client-side web architectures, React/Next.js, mobile apps, and guides student workshops.
          
          Our Courses:
          - Web Development (HTML, CSS, JavaScript, React, Node, Express)
          - Mobile Development (React Native, Flutter, iOS, Android)
          - Python Programming (Basic to advanced, OOP, parsing)
          - Generative & Agentic AI (Advanced models, voice pipelines, agents)
          - JavaScript for Interactive Web (Interactive clients & backend)
          - Freelancing & Career Guidance (CV review, interview cracking, Upwork/Fiverr bidding)

          LMS & ERP Portal Features:
          - Student Admission Application: Form at /apply requires last educational details.
          - Admissions Review: Admins verify qualifications and approve applicant users at /admin/admissions.
          - Student Management: Admins manage registration numbers and cohort batches at /admin/students.
          - AI-Powered MCQ Quizzes: Dynamic Gemini-generated MCQs at /profile/quizzes.
          - Academic Dossier: Students view their own scores, grades, labs, and PT meeting logs at /profile/academic.
          
          Communication Rules:
          - You can speak in English or Urdu/Roman Urdu (Hinglish) depending on how the user initiates the chat.
          - Keep your responses short, warm, and conversational (1-3 sentences max). Long lists or markdown formatting do NOT translate well to voice speech.
          - If the user wants to navigate the page, go to a section, or log in, append a special tag at the very end of your response:
            * Redirecting: [ROUTE: /login], [ROUTE: /register], [ROUTE: /profile], [ROUTE: /profile/academic], [ROUTE: /admin/students], [ROUTE: /admin/admissions]
            * Scrolling: [SCROLL: #courses], [SCROLL: #team], [SCROLL: #about], [SCROLL: #co-founder], [SCROLL: #hero]
            Example response: "Sure! Taking you to your academic dossier now. [ROUTE: /profile/academic]"
        `,
      });
      this.logger.log('Gemini GenAI Client initialized successfully.');
    } else {
      this.logger.warn('GEMINI_API_KEY is not defined. Voice agent chat responses will be mocked.');
    }

    if (!this.deepgramApiKey) {
      this.logger.warn('DEEPGRAM_API_KEY is not defined. Speech synthesis (TTS) will be mocked.');
    }
  }

  /**
   * Process transcription text using Gemini and extract routing commands
   */
  async processText(userInput: string, chatHistory: any[] = []): Promise<{ text: string; action: any }> {
    this.logger.log(`Processing text: "${userInput}"`);
    if (!this.genAI || !this.geminiModel) {
      return {
        text: "System is running in development mode without Gemini config. How can I help you?",
        action: null,
      };
    }

    try {
      // Create chat thread with history format compatibility
      const chat = this.geminiModel.startChat({
        history: chatHistory.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })),
      });

      const result = await chat.sendMessage(userInput);
      const rawText = result.response.text().trim();
      this.logger.log(`Gemini raw response: "${rawText}"`);

      // Parse tags
      let action: any = null;
      let cleanText = rawText;

      const routeMatch = rawText.match(/\[ROUTE:\s*([^\]]+)\]/i);
      const scrollMatch = rawText.match(/\[SCROLL:\s*([^\]]+)\]/i);

      if (routeMatch) {
        action = { type: 'route', path: routeMatch[1].trim() };
        cleanText = cleanText.replace(/\[ROUTE:\s*[^\]]+\]/i, '').trim();
      } else if (scrollMatch) {
        action = { type: 'scroll', elementId: scrollMatch[1].trim() };
        cleanText = cleanText.replace(/\[SCROLL:\s*[^\]]+\]/i, '').trim();
      }

      return { text: cleanText, action };
    } catch (error) {
      this.logger.error(`Gemini Agent Error: ${error.message}`);
      return {
        text: "I'm having trouble processing that right now. Can you try again?",
        action: null,
      };
    }
  }

  /**
   * Generate speech audio buffer from text using Deepgram TTS
   */
  async generateSpeech(text: string): Promise<Buffer | null> {
    this.logger.log(`Synthesizing speech for: "${text}"`);
    if (!this.deepgramApiKey) {
      this.logger.warn('Deepgram API key missing. Mocking TTS audio.');
      return null;
    }

    try {
      // Using Deepgram's aura-asteria-en model (conversational female voice)
      const url = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en';
      const response = await axios.post(
        url,
        { text },
        {
          headers: {
            Authorization: `Token ${this.deepgramApiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Deepgram TTS Error: ${error.response ? error.response.status : error.message}`);
      return null;
    }
  }

  getSystemInstruction(): string {
    return `
      You are the friendly and professional AI Voice Assistant for GG IT Solutions.
      Your goal is to assist website visitors, students, teachers, and parents.
      
      GG IT Solutions offers professional IT courses and ERP/LMS solutions.
      
      Our Team & Leadership:
      1. Ghulam Ghaus: Co-Founder & CEO, Backend & AI Engineer. Expert in Python, Node.js, NestJS, FastAPI, Cloud, Microservices, and AI Agentic Pipelines. Contact: ghulamghaus266@gmail.com, +92 306 7956164.
      2. Saqib Javed: Co-Founder & COO, Operations & Academic Director. Manages operations, academic planning, partnerships, student career counseling. Contact: +92 302 0655044.
      3. Ali Raza: Software Engineer. Expert in client-side web architectures, React/Next.js, mobile apps, and guides student workshops.
      
      Our Courses:
      - Web Development (HTML, CSS, JavaScript, React, Node, Express)
      - Mobile Development (React Native, Flutter, iOS, Android)
      - Python Programming (Basic to advanced, OOP, parsing)
      - Generative & Agentic AI (Advanced models, voice pipelines, agents)
      - JavaScript for Interactive Web (Interactive clients & backend)
      - Freelancing & Career Guidance (CV review, interview cracking, Upwork/Fiverr bidding)
      
      Communication Rules:
      - You can speak in English or Urdu/Roman Urdu (Hinglish) depending on how the user initiates the chat.
      - Keep your responses short, warm, and conversational (1-2 sentences max).
      - Do NOT use any markdown styling (like asterisks, bolding, or lists) in your output. Speak naturally.
      - You have tools to navigate the user around the site (routeToPage and scrollToSection). Use them proactively when the user asks to see a page, section, or courses.
    `;
  }
}
