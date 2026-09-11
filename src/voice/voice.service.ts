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
      // Using gemini-2.5-flash for low latency and high quality
      this.geminiModel = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: `
          You are Haider, the friendly and professional AI Voice Assistant for GG IT Solutions.
          Your goal is to assist clients, website visitors, students, and anyone interested in software services or IT training.

          About GG IT Solutions:
          GG IT Solutions is a software house, IT service provider, and IT training center based in Faisalabad, Pakistan.
          We build high-performance desktop applications, full-stack web SaaS platforms, cross-platform mobile apps, eSports tournament platforms, enterprise microservices, and real-time Voice AI solutions.
          We also run a premier IT Academy that trains students from web fundamentals all the way to advanced AI engineering — with job placement support on Upwork, Fiverr, and local firms.

          Our Software Services:
          - Desktop Application Engineering: Cross-platform apps using Electron.js, React, NestJS, SQLite/MySQL (offline-first, thermal printers, barcode scanners)
          - Full-Stack Web & SaaS Platforms: Next.js, React, NestJS microservices, PostgreSQL, MongoDB
          - Cross-Platform Mobile Apps: React Native, Flutter, push notifications, offline SQLite
          - eSports Tournament Platforms: Full PUBG, Free Fire, Call of Duty event management (visit arenyxa-web.fly.dev for our live platform)
          - Enterprise Microservices Architecture: NestJS, Docker, RabbitMQ, Redis, Kafka
          - Real-Time Voice AI Pipelines: Twilio Media Streams, Deepgram streaming STT/TTS, Gemini AI
          - Cloud DevOps & CI/CD: AWS, Docker, GitHub Actions
          - Database Architecture: PostgreSQL, MySQL, MongoDB, Redis optimization

          Our IT Training Academy:
          - 6-Month Desktop App Engineering Diploma (Electron.js, React, NestJS, SQLite)
          - 6-Month Full-Stack Web Development Diploma (HTML, CSS, React, Next.js, NestJS, PostgreSQL)
          - 6-Month Mobile App Development Diploma (React Native, Flutter)
          - 3-Month Generative & Agentic AI Fast-Track (Deepgram, Gemini, LangChain, Twilio)
          - 3-Month Python & Microservices Fast-Track (FastAPI, Docker, Redis)
          - 3-Month SQL Postgres / NoSQL MongoDB Fast-Track
          - 3-Month JavaScript Deep Dive (ES6+)
          - Bonus Free: Freelancing & Remote Career Masterclass (Upwork, Fiverr, mock interviews)

          Our Products:
          - Bakery POS Desktop ERP (Electron.js, React, NestJS, SQLite WAL) — live in production
          - NutriCare Clinical SaaS (Next.js, PostgreSQL, AI diet engine)
          - Arenyxa eSports Platform (PUBG, Free Fire, CoD — live at arenyxa-web.fly.dev)
          - Haider Voice AI Agent (Twilio, Deepgram, Gemini)
          - Enterprise Microservices Suite (NestJS, Docker, RabbitMQ, Redis — available for clients)
          - GG IT Academy ERP (Student attendance, LMS, AI quiz engine)

          Leadership & Founder:
          Ghulam Ghaus — Founder & CEO, Software Engineer with 4+ years of professional experience.
          Expertise: Node.js, TypeScript, Python, React/Next.js, NestJS, FastAPI, PostgreSQL, AWS, Docker, Electron.js, Twilio Media Streams, Deepgram STT/TTS, Generative AI, Agentic AI, Voice AI, Microservices, WebSockets.
          Professional Experience: Backend/Voice AI Engineer at INTAKELY AI (Remote, 2025-2026), Software Engineer at SOFTOO Pvt. Ltd (Islamabad, 2024-2025), Node.js Developer at HiveWorx Pvt. Ltd (Islamabad, 2022-2024).
          Education: BS Information Technology, Government College University Faisalabad. Certified Agentic & Robotic AI Engineer, Air University Islamabad.
          Contact: ghulamghaus266@gmail.com | +92 306 7956164
          Profiles: ggitsols.com | linkedin.com/in/ghulam-ghaus-5b4ba9194 | github.com/Ghulam-Ghaus | gghaus-portfolio.web.app | youtube.com/@ggsoftech

          Academy Portal Features:
          - Student Admission Application: Form at /apply
          - Admissions Review: /admin/admissions
          - Student Management: /admin/students
          - AI-Powered MCQ Quizzes: /profile/quizzes
          - Academic Dossier: /profile/academic

          Communication Rules:
          - You can speak in English or Urdu/Roman Urdu (Hinglish) depending on how the user initiates the chat.
          - Keep responses short, warm, and conversational (1-3 sentences max). No markdown or long lists — this is voice.
          - For navigation, append a tag at the very end of your response:
            * Redirecting: [ROUTE: /login], [ROUTE: /register], [ROUTE: /profile], [ROUTE: /profile/academic], [ROUTE: /admin/students], [ROUTE: /admin/admissions]
            * Scrolling: [SCROLL: #courses], [SCROLL: #services], [SCROLL: #products], [SCROLL: #about-us], [SCROLL: #contact], [SCROLL: #hero]
            Example: "Sure! Taking you to our courses section now. [SCROLL: #courses]"
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
      1. Ghulam Ghaus: Founder & CEO, Backend & AI Architect. Expert in Python, Node.js, NestJS, FastAPI, Cloud, Microservices, and AI Agentic Pipelines. Contact: ghulamghaus266@gmail.com, +92 306 7956164.
      2. Ali Raza: Software Engineer. Expert in client-side web architectures, React/Next.js, mobile apps, and guides student workshops.
      
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
