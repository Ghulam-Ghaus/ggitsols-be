import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationService } from '../common/services/notification.service';
import { NotificationService as EmailNotificationService } from '../notification/notification.service';


@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,
    private jwtService: JwtService,
    private notificationService: NotificationService,
    private emailNotificationService: EmailNotificationService,
  ) { }


  async onModuleInit() {
    await this.seedRoles();
  }

  async seedRoles() {
    const modules = ['users', 'admissions', 'courses', 'attendance', 'finance', 'exams', 'settings'];

    const getAdminPermissions = () => {
      const perms = {};
      modules.forEach(m => {
        perms[m] = { view: true, create: true, update: true, delete: true };
      });
      return perms;
    };

    const getTeacherPermissions = () => {
      const perms = {};
      modules.forEach(m => {
        const isAcademic = ['courses', 'attendance', 'exams'].includes(m);
        perms[m] = {
          view: isAcademic || m === 'users',
          create: isAcademic,
          update: isAcademic,
          delete: false
        };
      });
      return perms;
    };

    const getStudentPermissions = () => {
      const perms = {};
      modules.forEach(m => {
        const isAcademic = ['courses', 'attendance', 'exams'].includes(m);
        perms[m] = {
          view: isAcademic,
          create: false,
          update: false,
          delete: false
        };
      });
      return perms;
    };

    const getGuestPermissions = () => {
      const perms = {};
      modules.forEach(m => {
        perms[m] = { view: false, create: false, update: false, delete: false };
      });
      return perms;
    };

    const rolesToSeed = [
      { id: 1, name: 'ADMIN', description: 'System Administrator with full access', permissions: getAdminPermissions() },
      { id: 2, name: 'TEACHER', description: 'Academic staff members', permissions: getTeacherPermissions() },
      { id: 3, name: 'STUDENT', description: 'Enrolled students', permissions: getStudentPermissions() },
      { id: 4, name: 'PARENT', description: 'Parents or guardians of students', permissions: getStudentPermissions() },
      { id: 5, name: 'APPLICANT', description: 'Prospective students applying for admission', permissions: getGuestPermissions() },
      { id: 6, name: 'PUBLIC', description: 'Guest/non-registered visitors', permissions: getGuestPermissions() },
    ];

    for (const r of rolesToSeed) {
      const exists = await this.rolesRepository.findOne({ where: { id: r.id } });
      if (!exists) {
        await this.rolesRepository.save(this.rolesRepository.create(r));
        console.log(`[Seed] Created role: ${r.name}`);
      } else if (!exists.permissions) {
        exists.permissions = r.permissions;
        await this.rolesRepository.save(exists);
        console.log(`[Seed] Backfilled permissions for role: ${r.name}`);
      }
    }
  }

  async findAllRoles(): Promise<Role[]> {
    return this.rolesRepository.find();
  }

  async updateRolePermissions(id: number, permissions: any, description?: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    role.permissions = permissions;
    if (description !== undefined) {
      role.description = description;
    }

    return this.rolesRepository.save(role);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, roleId, ...rest } = createUserDto;

    // Check if email already registered
    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email address is already registered');
    }

    // Default to 'STUDENT' (role ID 3) if no role is supplied
    const finalRoleId = roleId || 3;

    if (finalRoleId === 1) {
      throw new ForbiddenException('Admin roles can only be created or assigned directly in the database');
    }

    const role = await this.rolesRepository.findOne({ where: { id: finalRoleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${finalRoleId} not found`);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = this.usersRepository.create({
      ...rest,
      email,
      passwordHash,
      roleId: finalRoleId,
    });

    const savedUser = await this.usersRepository.save(user);

    // Send a system notification
    await this.notificationService.sendNotification(
      savedUser.id,
      'Welcome!',
      `Welcome to GG IT Solutions, ${savedUser.firstName}! Your account has been successfully created.`,
    );

    // Remove passwordHash from returned object
    delete savedUser.passwordHash;
    return savedUser;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      where: { isDeleted: false },
      relations: { role: true }
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id, isDeleted: false },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const { password, roleId, ...rest } = updateUserDto;

    if (roleId) {
      if (roleId === 1) {
        throw new ForbiddenException('Admin roles can only be created or assigned directly in the database');
      }
      const role = await this.rolesRepository.findOne({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundException(`Role with ID ${roleId} not found`);
      }
      user.roleId = roleId;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    Object.assign(user, rest);
    const updatedUser = await this.usersRepository.save(user);
    delete updatedUser.passwordHash;
    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true }
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // 1. Soft delete the target user first
    await this.usersRepository.query(
      'UPDATE users SET is_deleted = true, is_active = false WHERE id = $1',
      [user.id]
    );

    // 2. If the user was a STUDENT, check if we need to soft-delete their guardians too
    if (user.role?.name === 'STUDENT') {
      const students = await this.usersRepository.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
      if (students.length > 0) {
        const studentId = students[0].id;

        // Find linked parents/guardians
        const parentStudentPairs = await this.usersRepository.query('SELECT parent_id FROM parent_students WHERE student_id = $1', [studentId]);
        for (const pair of parentStudentPairs) {
          const parentId = pair.parent_id;

          // Check if parent is linked to any remaining active (non-deleted) students
          const activeStudents = await this.usersRepository.query(
            `SELECT s.id FROM parent_students ps
             JOIN students s ON s.id = ps.student_id
             JOIN users u ON u.id = s.user_id
             WHERE ps.parent_id = $1 AND u.is_deleted = false`,
            [parentId]
          );

          // If no active students are left for this parent/guardian, soft-delete the parent user
          if (activeStudents.length === 0) {
            const parentUser = await this.usersRepository.query(
              'SELECT user_id FROM parents WHERE id = $1',
              [parentId]
            );
            if (parentUser.length > 0) {
              const parentUserId = parentUser[0].user_id;
              await this.usersRepository.query(
                'UPDATE users SET is_deleted = true, is_active = false WHERE id = $1',
                [parentUserId]
              );
            }
          }
        }
      }
    }
  }

  async login(email: string, pass: string): Promise<{ accessToken: string; user: any }> {
    // Explicitly select passwordHash since it's hidden by default
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email AND user.is_deleted = :isDeleted', { email, isDeleted: false })
      .getOne();

    if (!user || !user.passwordHash || !(await bcrypt.compare(pass, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is currently deactivated');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED: Please verify your email address before logging in.');
    }

    const payload = { 
      id: user.id, 
      email: user.email, 
      role: user.role.name, 
      permissions: user.role.permissions,
      firstName: user.firstName,
      lastName: user.lastName
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const userResponse = { ...user };
    delete userResponse.passwordHash;

    return {
      accessToken,
      user: userResponse,
    };
  }

  async generateAndSaveVerificationCode(email: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const emailVerification = this.emailVerificationRepository.create({
      email: email.toLowerCase().trim(),
      code,
      expiresAt,
    });
    await this.emailVerificationRepository.save(emailVerification);
    return code;
  }

  async sendVerificationCode(email: string): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim(), isActive: true, isDeleted: false }
    });
    if (!user) {
      throw new NotFoundException('No active account found with the provided email address');
    }
    if (user.isEmailVerified) {
      throw new ConflictException('Email is already verified');
    }

    const code = await this.generateAndSaveVerificationCode(email);

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #6366f1;">Verify Your Email Address</h2>
        <p>Thank you for registering at GG IT Solutions.</p>
        <p>Please enter the 6-digit verification code below to activate your portal login:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px 24px; background-color: #f1f5f9; border-radius: 8px; display: inline-block; color: #4f46e5; margin: 10px 0;">
          ${code}
        </div>
        <p style="color: #ef4444; font-weight: bold; font-size: 14px; margin-top: 10px;">Do not share this OTP/Verification Code with anyone.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">This code will expire in 10 minutes.</p>
      </div>
    `;

    await this.emailNotificationService.sendEmail(
      email,
      'Verify Your Email Address - GG IT Solutions',
      htmlContent
    );

    return { success: true, message: 'Verification code sent successfully' };
  }


  async verifyEmail(email: string, code: string): Promise<any> {
    const verification = await this.emailVerificationRepository.findOne({
      where: {
        email: email.toLowerCase().trim(),
        code: code.trim(),
        isUsed: false,
        expiresAt: MoreThan(new Date())
      },
      order: { createdAt: 'DESC' }
    });

    if (!verification) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    verification.isUsed = true;
    await this.emailVerificationRepository.save(verification);

    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim(), isDeleted: false }
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    user.isEmailVerified = true;
    await this.usersRepository.save(user);

    return { success: true, message: 'Email verified successfully! You can now log in.' };
  }

  async sendForgotPasswordCode(email: string): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim(), isActive: true, isDeleted: false },
    });
    if (!user) {
      throw new NotFoundException('No active account found with the provided email address');
    }

    const code = await this.generateAndSaveVerificationCode(email);

    // Send email via Resend
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #6366f1;">Password Reset Request</h2>
        <p>You requested to reset your password for the GG IT Solutions portal.</p>
        <p>Your 6-digit verification code is:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px 24px; background-color: #f1f5f9; border-radius: 8px; display: inline-block; color: #4f46e5; margin: 10px 0;">
          ${code}
        </div>
        <p style="color: #ef4444; font-weight: bold; font-size: 14px; margin-top: 10px;">Do not share this OTP/Verification Code with anyone.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">This code will expire in 10 minutes. If you did not make this request, please ignore this email.</p>
      </div>
    `;

    await this.emailNotificationService.sendEmail(
      email,
      'Your GG IT Solutions Password Reset Verification Code',
      htmlContent
    );

    return { success: true, message: 'Verification code sent successfully' };
  }


  async resetPasswordWithCode(body: any): Promise<any> {
    const { email, code, newPassword } = body;
    if (!email || !code || !newPassword) {
      throw new ConflictException('Email, verification code, and new password are required');
    }

    const verification = await this.emailVerificationRepository.findOne({
      where: {
        email: email.toLowerCase().trim(),
        code: code.trim(),
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' }
    });

    if (!verification) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    // Mark code as used
    verification.isUsed = true;
    await this.emailVerificationRepository.save(verification);

    // Update user's password
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim(), isActive: true, isDeleted: false }
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await this.usersRepository.save(user);

    return { success: true, message: 'Password reset successfully' };
  }

  async hardDelete(id: string): Promise<void> {
    const students = await this.usersRepository.query('SELECT id FROM students WHERE user_id = $1', [id]);
    if (students.length > 0) {
      const studentId = students[0].id;
      await this.usersRepository.query('DELETE FROM parent_students WHERE student_id = $1', [studentId]);
      await this.usersRepository.query('DELETE FROM attendance_records WHERE student_id = $1', [studentId]);
      await this.usersRepository.query('DELETE FROM quiz_attempts WHERE student_id = $1', [studentId]);
      await this.usersRepository.query('DELETE FROM lab_submissions WHERE student_id = $1', [studentId]);
      await this.usersRepository.query('DELETE FROM meeting_reviews WHERE student_id = $1', [studentId]);
      await this.usersRepository.query('DELETE FROM fee_collections WHERE student_id = $1', [studentId]);
      await this.usersRepository.query('DELETE FROM students WHERE id = $1', [studentId]);
    }

    const parents = await this.usersRepository.query('SELECT id FROM parents WHERE user_id = $1', [id]);
    if (parents.length > 0) {
      const parentId = parents[0].id;
      await this.usersRepository.query('DELETE FROM parent_students WHERE parent_id = $1', [parentId]);
      await this.usersRepository.query('DELETE FROM parents WHERE id = $1', [parentId]);
    }

    await this.usersRepository.query('DELETE FROM salary_slips WHERE user_id = $1', [id]);
    await this.usersRepository.query('DELETE FROM users WHERE id = $1', [id]);
  }
}


