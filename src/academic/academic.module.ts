import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { Batch } from './entities/batch.entity';
import { Student } from './entities/student.entity';
import { User } from '../users/entities/user.entity';
import { Quiz } from './entities/quiz.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { LabSubmission } from './entities/lab-submission.entity';
import { MeetingReview } from './entities/meeting-review.entity';
import { Attendance } from './entities/attendance.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { TeacherAttendance } from './entities/teacher-attendance.entity';
import { Parent } from './entities/parent.entity';
import { AcademicService } from './academic.service';
import { AcademicController } from './academic.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Batch,
      Student,
      User,
      Quiz,
      QuizAttempt,
      LabSubmission,
      MeetingReview,
      Attendance,
      AttendanceRecord,
      TeacherAttendance,
      Parent,
    ]),
  ],
  providers: [AcademicService],
  controllers: [AcademicController],
  exports: [AcademicService],
})
export class AcademicModule {}
