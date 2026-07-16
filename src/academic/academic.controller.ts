import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AcademicService } from './academic.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  // ==========================================
  // COURSES ENDPOINTS
  // ==========================================

  @Get('courses')
  async getAllCourses() {
    return this.academicService.findAllCourses();
  }

  @Get('courses/:id')
  async getCourseById(@Param('id') id: string) {
    return this.academicService.findOneCourse(Number(id));
  }

  @Post('courses')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createCourse(@Body() body: { name: string; fee: number; monthlyFee?: number; fullPaymentDiscount?: number; duration?: string; sortNo?: number }) {
    return this.academicService.createCourse(body);
  }

  @Put('courses/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateCourse(
    @Param('id') id: string,
    @Body() body: { name?: string; fee?: number; monthlyFee?: number; fullPaymentDiscount?: number; duration?: string; sortNo?: number },
  ) {
    return this.academicService.updateCourse(Number(id), body);
  }

  @Delete('courses/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteCourse(@Param('id') id: string) {
    return this.academicService.removeCourse(Number(id));
  }

  // ==========================================
  // BATCHES ENDPOINTS
  // ==========================================

  @Get('batches')
  async getAllBatches() {
    return this.academicService.findAllBatches();
  }

  @Get('batches/:id')
  async getBatchById(@Param('id') id: string) {
    return this.academicService.findOneBatch(Number(id));
  }

  @Post('batches')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createBatch(
    @Body() body: { name: string; courseId: number; startDate: string; endDate: string; isActive?: boolean },
  ) {
    return this.academicService.createBatch(body);
  }

  @Put('batches/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateBatch(
    @Param('id') id: string,
    @Body() body: { name?: string; courseId?: number; startDate?: string; endDate?: string; isActive?: boolean },
  ) {
    return this.academicService.updateBatch(Number(id), body);
  }

  @Delete('batches/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteBatch(@Param('id') id: string) {
    return this.academicService.removeBatch(Number(id));
  }

  // ==========================================
  // ASSIGNMENTS ENDPOINTS
  // ==========================================

  @Post('batches/:id/students')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async assignStudents(@Param('id') id: string, @Body() body: { studentIds: number[] }) {
    return this.academicService.assignStudentsToBatch(Number(id), body.studentIds);
  }

  @Delete('batches/:id/students')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async removeStudents(@Param('id') id: string, @Body() body: { studentIds: number[] }) {
    return this.academicService.removeStudentsFromBatch(Number(id), body.studentIds);
  }

  @Get('batches/:id/students')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async getBatchStudents(@Param('id') id: string) {
    return this.academicService.getBatchStudents(Number(id));
  }

  @Get('unassigned-students')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUnassignedStudents() {
    return this.academicService.getUnassignedStudents();
  }

  // ==========================================
  // STUDENT PERFORMANCE DETAILS
  // ==========================================

  @Get('students/me')
  @UseGuards(AuthGuard)
  async getMyStudentProfile(@Request() req: any) {
    return this.academicService.findStudentByUserId(req.user.id);
  }

  @Get('students/me/details')
  @UseGuards(AuthGuard)
  async getMyStudentDetails(@Request() req: any) {
    return this.academicService.getStudentFullDetails(req.user.id);
  }

  @Get('students')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAllStudents() {
    return this.academicService.findAllStudents();
  }

  @Patch('students/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStudent(
    @Param('id') id: string,
    @Body() body: { registrationNo?: string; batchId?: number | null },
  ) {
    return this.academicService.updateStudent(Number(id), body);
  }

  @Get('students/user/:userId/details')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getStudentDetails(@Param('userId') userId: string) {
    return this.academicService.getStudentFullDetails(userId);
  }

  // ==========================================
  // DYNAMIC AI QUIZZES ENDPOINTS
  // ==========================================

  @Post('quizzes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createQuiz(
    @Body() body: {
      title: string;
      topic: string;
      difficulty: string;
      numQuestions: number;
      durationDays: number;
      timeLimitMins: number;
      allowedAttempts: number;
      batchId: number;
    },
  ) {
    return this.academicService.createQuiz(body);
  }

  @Get('batches/:batchId/quizzes')
  @UseGuards(AuthGuard)
  async getBatchQuizzes(@Param('batchId') batchId: string) {
    return this.academicService.findQuizzesForBatch(Number(batchId));
  }

  @Post('quizzes/:id/attempts')
  @UseGuards(AuthGuard)
  async startQuizAttempt(@Param('id') quizId: string, @Request() req: any) {
    const student = await this.academicService.findStudentByUserId(req.user.id);
    return this.academicService.startQuizAttempt(Number(quizId), student.id);
  }

  @Post('quizzes/attempts/:id/submit')
  @UseGuards(AuthGuard)
  async submitQuizAttempt(
    @Param('id') attemptId: string,
    @Body() body: { answers: Record<number, string> },
    @Request() req: any,
  ) {
    const student = await this.academicService.findStudentByUserId(req.user.id);
    return this.academicService.submitQuizAttempt(Number(attemptId), student.id, body.answers);
  }

  // ==========================================
  // STUDENT ATTENDANCE ENDPOINTS
  // ==========================================

  @Post('attendance')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async submitStudentAttendance(
    @Request() req: any,
    @Body() body: {
      batchId: number;
      date: string;
      records: { studentId: number; status: string; remarks?: string }[];
    },
  ) {
    return this.academicService.submitStudentAttendance(
      body.batchId,
      body.date,
      req.user.id,
      body.records,
    );
  }

  @Get('batches/:id/attendance')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async getBatchAttendanceLogs(@Param('id') id: string) {
    return this.academicService.getBatchAttendanceLogs(Number(id));
  }

  @Get('attendance/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async getAttendanceDetails(@Param('id') id: string) {
    return this.academicService.getAttendanceDetails(Number(id));
  }

  @Get('students/:studentId/attendance-summary')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async getStudentAttendanceSummary(@Param('studentId') studentId: string) {
    return this.academicService.getStudentAttendanceSummary(Number(studentId));
  }

  @Get('students/me/attendance')
  @UseGuards(AuthGuard)
  async getMyAttendanceHistory(@Request() req: any) {
    return this.academicService.getStudentAttendanceHistory(req.user.id);
  }

  // ==========================================
  // TEACHER ATTENDANCE ENDPOINTS
  // ==========================================

  @Post('teacher-attendance/check-in')
  @UseGuards(AuthGuard)
  async teacherCheckIn(
    @Request() req: any,
    @Body() body: { date: string; checkInTime: string; remarks?: string },
  ) {
    return this.academicService.teacherCheckIn(
      req.user.id,
      body.date,
      new Date(body.checkInTime),
      body.remarks,
    );
  }

  @Post('teacher-attendance/check-out')
  @UseGuards(AuthGuard)
  async teacherCheckOut(
    @Request() req: any,
    @Body() body: { date: string; checkOutTime: string },
  ) {
    return this.academicService.teacherCheckOut(
      req.user.id,
      body.date,
      new Date(body.checkOutTime),
    );
  }

  @Get('teacher-attendance/today')
  @UseGuards(AuthGuard)
  async getTeacherTodayStatus(
    @Request() req: any,
    @Query('date') dateQuery?: string,
  ) {
    const todayStr = dateQuery || new Date().toLocaleDateString('en-CA');
    return this.academicService.getTeacherTodayStatus(req.user.id, todayStr);
  }

  @Get('teacher-attendance/me')
  @UseGuards(AuthGuard)
  async getMyTeacherAttendanceHistory(@Request() req: any) {
    return this.academicService.getTeacherAttendanceHistory(req.user.id);
  }

  @Get('teacher-attendance/daily')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getDailyTeacherSheet(@Query('date') dateQuery?: string) {
    const todayStr = dateQuery || new Date().toLocaleDateString('en-CA');
    return this.academicService.getDailyTeacherSheet(todayStr);
  }

  @Post('teacher-attendance/daily')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async markTeacherAttendance(
    @Body() body: {
      userId: string;
      date: string;
      status: string;
      checkInTime?: string;
      checkOutTime?: string;
      remarks?: string;
    },
  ) {
    return this.academicService.markTeacherAttendance(
      body.userId,
      body.date,
      body.status,
      body.checkInTime ? new Date(body.checkInTime) : undefined,
      body.checkOutTime ? new Date(body.checkOutTime) : undefined,
      body.remarks,
    );
  }

  // ==========================================
  // PARENT PORTAL ENDPOINTS
  // ==========================================

  @Get('parents/my-students')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PARENT', 'ADMIN')
  async getParentStudents(@Request() req: any) {
    return this.academicService.getParentStudents(req.user.id);
  }

  @Get('parents/students/:studentId/details')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PARENT', 'ADMIN')
  async getChildDetails(
    @Param('studentId') studentId: string,
    @Request() req: any,
  ) {
    return this.academicService.getChildDetails(req.user.id, Number(studentId));
  }

  @Get('parents/students/:studentId/attendance')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PARENT', 'ADMIN')
  async getChildAttendance(
    @Param('studentId') studentId: string,
    @Request() req: any,
  ) {
    return this.academicService.getChildAttendance(req.user.id, Number(studentId));
  }
}
