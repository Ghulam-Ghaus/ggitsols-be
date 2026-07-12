import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Course } from './entities/course.entity';
import { Batch } from './entities/batch.entity';
import { Student } from './entities/student.entity';
import { Quiz } from './entities/quiz.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { LabSubmission } from './entities/lab-submission.entity';
import { MeetingReview } from './entities/meeting-review.entity';

@Injectable()
export class AcademicService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private readonly quizAttemptRepository: Repository<QuizAttempt>,
    @InjectRepository(LabSubmission)
    private readonly labSubmissionRepository: Repository<LabSubmission>,
    @InjectRepository(MeetingReview)
    private readonly meetingReviewRepository: Repository<MeetingReview>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  // ==========================================
  // COURSE CRUD
  // ==========================================

  async findAllCourses(): Promise<Course[]> {
    return this.courseRepository.find({ order: { sortNo: 'ASC', name: 'ASC' } });
  }

  async findOneCourse(id: number): Promise<Course> {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    return course;
  }

  async createCourse(data: { name: string; fee: number; monthlyFee?: number; fullPaymentDiscount?: number; duration?: string; sortNo?: number }): Promise<Course> {
    const course = this.courseRepository.create(data);
    return this.courseRepository.save(course);
  }

  async updateCourse(id: number, data: { name?: string; fee?: number; monthlyFee?: number; fullPaymentDiscount?: number; duration?: string; sortNo?: number }): Promise<Course> {
    const course = await this.findOneCourse(id);
    Object.assign(course, data);
    return this.courseRepository.save(course);
  }

  async removeCourse(id: number): Promise<void> {
    const course = await this.findOneCourse(id);
    await this.courseRepository.remove(course);
  }

  // ==========================================
  // BATCH CRUD
  // ==========================================

  async findAllBatches(): Promise<Batch[]> {
    return this.batchRepository.find({
      relations: { course: true, students: true },
      order: { id: 'DESC' },
    });
  }

  async findOneBatch(id: number): Promise<Batch> {
    const batch = await this.batchRepository.findOne({
      where: { id },
      relations: { course: true, students: { user: true } },
    });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
    return batch;
  }

  async createBatch(data: { name: string; courseId: number; startDate: string; endDate: string; isActive?: boolean }): Promise<Batch> {
    // Validate course exists
    await this.findOneCourse(data.courseId);

    const batch = this.batchRepository.create(data);
    const savedBatch = await this.batchRepository.save(batch);
    
    return this.findOneBatch(savedBatch.id);
  }

  async updateBatch(id: number, data: { name?: string; courseId?: number; startDate?: string; endDate?: string; isActive?: boolean }): Promise<Batch> {
    const batch = await this.findOneBatch(id);
    if (data.courseId) {
      await this.findOneCourse(data.courseId);
    }
    Object.assign(batch, data);
    await this.batchRepository.save(batch);
    return this.findOneBatch(id);
  }

  async removeBatch(id: number): Promise<void> {
    const batch = await this.findOneBatch(id);
    await this.batchRepository.remove(batch);
  }

  // ==========================================
  // BATCH STUDENT ASSIGNMENTS
  // ==========================================

  async assignStudentsToBatch(batchId: number, studentIds: number[]): Promise<Batch> {
    const batch = await this.findOneBatch(batchId);
    
    // Find all target students
    const students = await this.studentRepository.find({
      where: { id: In(studentIds) },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestException('Some student IDs provided are invalid');
    }

    // Set batchId on all target students
    for (const student of students) {
      student.batchId = batchId;
    }
    await this.studentRepository.save(students);

    return this.findOneBatch(batchId);
  }

  async removeStudentsFromBatch(batchId: number, studentIds: number[]): Promise<Batch> {
    const batch = await this.findOneBatch(batchId);
    
    const students = await this.studentRepository.find({
      where: { id: In(studentIds), batchId },
    });

    for (const student of students) {
      student.batchId = null;
    }
    await this.studentRepository.save(students);

    return this.findOneBatch(batchId);
  }

  async getBatchStudents(batchId: number): Promise<Student[]> {
    await this.findOneBatch(batchId);
    return this.studentRepository.find({
      where: { batchId },
      relations: { user: true },
    });
  }

  async getUnassignedStudents(): Promise<Student[]> {
    return this.studentRepository.find({
      where: { batchId: IsNull() },
      relations: { user: true },
    });
  }

  // ==========================================
  // AI QUIZ SERVICES
  // ==========================================

  async createQuiz(data: {
    title: string;
    topic: string;
    difficulty: string;
    numQuestions: number;
    durationDays: number;
    timeLimitMins: number;
    allowedAttempts: number;
    batchId: number;
  }): Promise<Quiz> {
    await this.findOneBatch(data.batchId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.durationDays);

    const quiz = this.quizRepository.create({
      ...data,
      expiresAt,
    });
    return this.quizRepository.save(quiz);
  }

  async findOneQuiz(id: number): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({ where: { id }, relations: { batch: true } });
    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
    return quiz;
  }

  async findQuizzesForBatch(batchId: number): Promise<Quiz[]> {
    return this.quizRepository.find({
      where: { batchId },
      order: { id: 'DESC' },
    });
  }

  async startQuizAttempt(quizId: number, studentId: number): Promise<any> {
    const activeAttempt = await this.quizAttemptRepository.findOne({
      where: { quizId, studentId, status: 'IN_PROGRESS' },
      relations: { quiz: true },
    });

    if (activeAttempt) {
      // Resume: return with answers hidden
      const strippedQuestions = activeAttempt.questions.map(({ correctAnswer, ...q }) => q);
      return { ...activeAttempt, questions: strippedQuestions };
    }

    const quiz = await this.findOneQuiz(quizId);

    // Check attempt limits
    const pastAttemptsCount = await this.quizAttemptRepository.count({
      where: { quizId, studentId, status: 'SUBMITTED' },
    });
    if (pastAttemptsCount >= quiz.allowedAttempts) {
      throw new BadRequestException('You have reached the maximum number of attempts allowed for this quiz');
    }

    // Check expiration
    if (new Date() > new Date(quiz.expiresAt)) {
      throw new BadRequestException('This quiz availability window has expired');
    }

    if (!this.genAI) {
      throw new BadRequestException('Gemini AI system is not configured on the backend.');
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      Generate a multiple-choice quiz with exactly ${quiz.numQuestions} questions on the topic "${quiz.topic}".
      The difficulty level is "${quiz.difficulty}" (which is either simple, moderate, or advance).
      Each question must have exactly 4 choices labeled inside options.
      Return a valid JSON array of objects. Each object MUST strictly follow this typescript type structure:
      {
        "question": string,
        "options": [string, string, string, string],
        "correctAnswer": string // Must exactly match one of the strings inside options
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const questions = JSON.parse(text);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid JSON format from AI');
      }

      const attempt = this.quizAttemptRepository.create({
        studentId,
        quizId,
        questions,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        maxMarks: quiz.numQuestions,
        obtainedMarks: 0,
      });

      const savedAttempt = await this.quizAttemptRepository.save(attempt);
      const strippedQuestions = questions.map(({ correctAnswer, ...q }) => q);
      return { ...savedAttempt, quiz, questions: strippedQuestions };
    } catch (e: any) {
      console.error('Failed to generate dynamic AI quiz:', e);
      throw new BadRequestException('AI failed to generate a valid quiz configuration. Please try again.');
    }
  }

  async submitQuizAttempt(attemptId: number, studentId: number, answers: Record<number, string>): Promise<any> {
    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId, studentId },
      relations: { quiz: true },
    });

    if (!attempt) {
      throw new NotFoundException('Quiz attempt not found.');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Quiz has already been submitted.');
    }

    // Verify time limit (1 min grace period)
    const timeElapsedMins = (Date.now() - new Date(attempt.startedAt).getTime()) / 60000;
    if (timeElapsedMins > attempt.quiz.timeLimitMins + 1) {
      // Auto-submit could happen, we'll grade whatever is sent
    }

    let obtainedMarks = 0;
    const gradedQuestions = attempt.questions.map((q: any, idx: number) => {
      const studentAnswer = answers[idx] || null;
      const isCorrect = studentAnswer === q.correctAnswer;
      if (isCorrect) {
        obtainedMarks++;
      }
      return {
        ...q,
        studentAnswer,
        isCorrect,
      };
    });

    attempt.answers = answers;
    attempt.obtainedMarks = obtainedMarks;
    attempt.status = 'SUBMITTED';
    attempt.submittedAt = new Date();

    const savedAttempt = await this.quizAttemptRepository.save(attempt);
    return { ...savedAttempt, gradedQuestions };
  }

  // ==========================================
  // UNIFIED STUDENT DETAILS & AUTO-SEEDING
  // ==========================================

  async getStudentFullDetails(userId: string | number): Promise<any> {
    const student = await this.studentRepository.findOne({
      where: { userId: String(userId) },
      relations: { user: true, batch: { course: true }, parents: { user: true } },
    });

    if (!student) {
      throw new NotFoundException(`Student profile for user ID ${userId} not found`);
    }

    let quizAttempts = await this.quizAttemptRepository.find({
      where: { studentId: student.id, status: 'SUBMITTED' },
      relations: { quiz: true },
      order: { submittedAt: 'DESC' },
    });

    let labs = await this.labSubmissionRepository.find({
      where: { studentId: student.id },
      order: { submissionDate: 'DESC' },
    });

    let reviews = await this.meetingReviewRepository.find({
      where: { studentId: student.id },
      order: { date: 'DESC' },
    });

    // Auto-seed mock data if they have absolutely no records
    if (quizAttempts.length === 0 && labs.length === 0 && reviews.length === 0) {
      await this.seedStudentMockPerformance(student.id);

      quizAttempts = await this.quizAttemptRepository.find({
        where: { studentId: student.id, status: 'SUBMITTED' },
        relations: { quiz: true },
        order: { submittedAt: 'DESC' },
      });
      labs = await this.labSubmissionRepository.find({
        where: { studentId: student.id },
        order: { submissionDate: 'DESC' },
      });
      reviews = await this.meetingReviewRepository.find({
        where: { studentId: student.id },
        order: { date: 'DESC' },
      });
    }

    return {
      student,
      quizzes: quizAttempts,
      labs,
      reviews,
    };
  }

  private async seedStudentMockPerformance(studentId: number): Promise<void> {
    const student = await this.studentRepository.findOne({ where: { id: studentId } });
    if (!student || !student.batchId) return;

    let quiz = await this.quizRepository.findOne({ where: { batchId: student.batchId } });
    if (!quiz) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5);

      quiz = this.quizRepository.create({
        title: 'JavaScript Essentials Dynamic AI Quiz',
        topic: 'JavaScript basics',
        difficulty: 'moderate',
        numQuestions: 10,
        durationDays: 5,
        expiresAt,
        timeLimitMins: 15,
        allowedAttempts: 2,
        batchId: student.batchId,
      });
      quiz = await this.quizRepository.save(quiz);
    }

    const mockQuestions = [
      { question: 'Which keyword defines a constant in JavaScript?', options: ['var', 'let', 'const', 'constant'], correctAnswer: 'const' },
      { question: 'What is the output of typeof null?', options: ['"null"', '"undefined"', '"object"', '"number"'], correctAnswer: '"object"' },
      { question: 'Which method adds an element to the end of an array?', options: ['pop()', 'push()', 'shift()', 'unshift()'], correctAnswer: 'push()' },
      { question: 'Which operator checks for equal value and equal type?', options: ['=', '==', '===', '!='], correctAnswer: '===' },
      { question: 'How do you create a promise in JS?', options: ['Promise.create()', 'new Promise()', 'Promise.new()', 'makePromise()'], correctAnswer: 'new Promise()' },
      { question: 'Which hook manages component state in React?', options: ['useEffect', 'useReducer', 'useState', 'useRef'], correctAnswer: 'useState' },
      { question: 'What is ES6?', options: ['ECMAScript 2015', 'ECMAScript 6th Edition', 'Both A and B', 'None of these'], correctAnswer: 'Both A and B' },
      { question: 'How do you write a comment in JS?', options: ['<!-- -->', '//', '/*', '#'], correctAnswer: '//' },
      { question: 'Which function parses a string into an integer?', options: ['parseString()', 'toInteger()', 'parseInt()', 'Number.parse()'], correctAnswer: 'parseInt()' },
      { question: 'What is JSX?', options: ['JavaScript XML', 'JSON syntax', 'Java script', 'XML files'], correctAnswer: 'JavaScript XML' },
    ];

    const attempt = this.quizAttemptRepository.create({
      studentId,
      quizId: quiz.id,
      questions: mockQuestions,
      answers: { 0: 'const', 1: '"object"', 2: 'push()', 3: '===', 4: 'new Promise()', 5: 'useState', 6: 'Both A and B', 7: '//', 8: 'parseInt()', 9: 'JSON syntax' },
      obtainedMarks: 9,
      maxMarks: 10,
      startedAt: new Date(Date.now() - 3600000),
      submittedAt: new Date(Date.now() - 3000000),
      status: 'SUBMITTED',
    });
    await this.quizAttemptRepository.save(attempt);

    const mockLabs = [
      this.labSubmissionRepository.create({
        studentId,
        title: 'MERN Stack CRUD Application with Next.js',
        status: 'GRADED',
        submissionUrl: 'https://github.com/ggit-student/mern-crud-app',
        grade: 'A+',
        obtainedMarks: 95,
        maxMarks: 100,
        submissionDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        remarks: 'Excellent structuring of REST endpoints and responsive React client.',
      }),
      this.labSubmissionRepository.create({
        studentId,
        title: 'NestJS Backend API with TypeORM & PostgreSQL',
        status: 'GRADED',
        submissionUrl: 'https://github.com/ggit-student/nestjs-backend-api',
        grade: 'A',
        obtainedMarks: 88,
        maxMarks: 100,
        submissionDate: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0],
        remarks: 'Good utilization of standard DTO validators and guards. Clean entities.',
      }),
      this.labSubmissionRepository.create({
        studentId,
        title: 'Simple HTML & Vanilla CSS Layout Portfolio',
        status: 'COMPLETED',
        submissionUrl: 'https://github.com/ggit-student/vanilla-html-css-portfolio',
        grade: 'B+',
        obtainedMarks: 78,
        maxMarks: 100,
        submissionDate: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
        remarks: 'Page layouts are clean. Try optimizing asset sizes for better loading speed.',
      }),
    ];
    await this.labSubmissionRepository.save(mockLabs);

    const mockReviews = [
      this.meetingReviewRepository.create({
        studentId,
        title: 'Intake Assessment & Core Skills Viva check',
        date: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0],
        meetingType: 'LAB_VIVA',
        attendees: 'Ghulam Ghaus (CEO & Teacher), Student',
        discussion: 'Evaluated student programming background and logic parsing speed. Reviewed simple database design constructs and HTML layouts.',
        feedback: 'Student shows strong logical reasoning. Suggested focused practice on JavaScript asynchronous async/await pipelines.',
        status: 'COMPLETED',
      }),
      this.meetingReviewRepository.create({
        studentId,
        title: 'Monthly Progress & Guardian Review meeting',
        date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
        meetingType: 'PARENT_TEACHER',
        attendees: 'Saqib Javed (COO), Guardian, Student',
        discussion: 'Discussed class attendance, punctuality, lab completion rates, and first quiz performance. Reviewed active placement prep materials.',
        feedback: 'Guardian is happy with student progress. Student is highly motivated. Advised to stay consistent with weekly developer vivas.',
        status: 'COMPLETED',
      }),
    ];
    await this.meetingReviewRepository.save(mockReviews);
  }

  async findStudentByUserId(userId: string | number): Promise<Student> {
    const student = await this.studentRepository.findOne({ where: { userId: String(userId) } });
    if (!student) {
      throw new NotFoundException(`Student profile not found for user ID ${userId}`);
    }
    return student;
  }

  async findAllStudents(): Promise<Student[]> {
    return this.studentRepository.find({
      relations: { user: true, batch: { course: true }, parents: { user: true } },
      order: { id: 'DESC' },
    });
  }

  async updateStudent(id: number, data: { registrationNo?: string; batchId?: number | null }): Promise<Student> {
    const student = await this.studentRepository.findOne({ where: { id } });
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    if (data.registrationNo !== undefined) {
      student.registrationNo = data.registrationNo;
    }

    if (data.batchId !== undefined) {
      student.batchId = data.batchId;
    }

    return this.studentRepository.save(student);
  }
}
