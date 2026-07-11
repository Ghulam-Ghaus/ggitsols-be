import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Application } from './entities/application.entity';
import { ApplicationDocument } from './entities/application-document.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { User } from '../users/entities/user.entity';
import { Student } from '../academic/entities/student.entity';
import { Parent } from '../academic/entities/parent.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AdmissionsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(ApplicationDocument)
    private readonly docRepository: Repository<ApplicationDocument>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Parent)
    private readonly parentRepository: Repository<Parent>,
    private readonly emailNotificationService: NotificationService,
  ) {}

  /**
   * Submit a new student application
   */
  async apply(dto: CreateApplicationDto): Promise<Application> {
    const { documents, ...rest } = dto;
    
    const app = this.applicationRepository.create(rest);
    const savedApp = await this.applicationRepository.save(app);

    if (documents && documents.length > 0) {
      const docEntities = documents.map((doc) =>
        this.docRepository.create({
          ...doc,
          applicationId: savedApp.id,
        }),
      );
      await this.docRepository.save(docEntities);
    }

    // Provision User and Student profiles immediately
    let user = await this.userRepository.findOne({ where: { email: savedApp.email } });
    if (!user) {
      // Hash a default password: GGIT1234
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('GGIT1234', salt);

      // Split fullName into firstName & lastName
      const nameParts = savedApp.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Applicant';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      user = this.userRepository.create({
        email: savedApp.email,
        passwordHash,
        firstName,
        lastName,
        roleId: 3, // STUDENT role ID
        phone: savedApp.phone,
        isActive: true, // Keep it active so they can log in for testing
      });
      user = await this.userRepository.save(user);
    }

    // Provision Student record
    let student = await this.studentRepository.findOne({ where: { userId: user.id } });
    if (!student) {
      const registrationNo = `GGIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      student = this.studentRepository.create({
        userId: user.id,
        registrationNo,
        admissionDate: new Date().toISOString().split('T')[0], // yyyy-mm-dd
      });
      student = await this.studentRepository.save(student);
    }

    // Provision Parent/Guardian profile if guardianEmail is provided
    if (savedApp.guardianEmail) {
      let parentUser = await this.userRepository.findOne({ where: { email: savedApp.guardianEmail } });
      if (!parentUser) {
        const salt = await bcrypt.genSalt(10);
        const parentPasswordHash = await bcrypt.hash('GGIT1234', salt);

        const guardianParts = savedApp.guardianName ? savedApp.guardianName.trim().split(/\s+/) : ['Guardian'];
        const parentFirstName = guardianParts[0] || 'Guardian';
        const parentLastName = guardianParts.slice(1).join(' ') || 'User';

        parentUser = this.userRepository.create({
          email: savedApp.guardianEmail,
          passwordHash: parentPasswordHash,
          firstName: parentFirstName,
          lastName: parentLastName,
          roleId: 4, // PARENT role ID
          phone: savedApp.guardianPhone,
          isActive: true,
        });
        parentUser = await this.userRepository.save(parentUser);
      }

      let parent = await this.parentRepository.findOne({
        where: { userId: parentUser.id },
        relations: { students: true }
      });
      if (!parent) {
        parent = this.parentRepository.create({
          userId: parentUser.id,
          students: [student]
        });
        await this.parentRepository.save(parent);
      } else {
        if (!parent.students) {
          parent.students = [];
        }
        if (!parent.students.find(s => s.id === student.id)) {
          parent.students.push(student);
          await this.parentRepository.save(parent);
        }
      }
    }

    // Provision Secondary Parent/Guardian profile if guardian2Email is provided
    if (savedApp.guardian2Email) {
      let parent2User = await this.userRepository.findOne({ where: { email: savedApp.guardian2Email } });
      if (!parent2User) {
        const salt = await bcrypt.genSalt(10);
        const parent2PasswordHash = await bcrypt.hash('GGIT1234', salt);

        const guardian2Parts = savedApp.guardian2Name ? savedApp.guardian2Name.trim().split(/\s+/) : ['Guardian'];
        const parent2FirstName = guardian2Parts[0] || 'Guardian';
        const parent2LastName = guardian2Parts.slice(1).join(' ') || 'User';

        parent2User = this.userRepository.create({
          email: savedApp.guardian2Email,
          passwordHash: parent2PasswordHash,
          firstName: parent2FirstName,
          lastName: parent2LastName,
          roleId: 4, // PARENT role ID
          phone: savedApp.guardian2Phone,
          isActive: true,
        });
        parent2User = await this.userRepository.save(parent2User);
      }

      let parent2 = await this.parentRepository.findOne({
        where: { userId: parent2User.id },
        relations: { students: true }
      });
      if (!parent2) {
        parent2 = this.parentRepository.create({
          userId: parent2User.id,
          students: [student]
        });
        await this.parentRepository.save(parent2);
      } else {
        if (!parent2.students) {
          parent2.students = [];
        }
        if (!parent2.students.find(s => s.id === student.id)) {
          parent2.students.push(student);
          await this.parentRepository.save(parent2);
        }
      }
    }

    // Generate dummy verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Send verification email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #3b82f6; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">GG IT Solutions</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Admissions & Student Portal</p>
        </div>
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px; border-radius: 16px; text-align: center; color: #ffffff; margin-bottom: 24px;">
          <h3 style="margin: 0; font-size: 20px; font-weight: 700;">Welcome, ${savedApp.fullName}!</h3>
          <p style="font-size: 14px; opacity: 0.9; margin: 8px 0 0 0;">Thank you for submitting your admission application.</p>
        </div>
        <div style="margin-bottom: 24px; color: #334155; font-size: 15px; line-height: 1.6;">
          <p>We have successfully received your application. Your student account has been created with the following details:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 120px;">Username/Email:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${savedApp.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Temp Password:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 500;"><code>GGIT1234</code></td>
            </tr>
          </table>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Verification Code</p>
          <span style="font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: 4px;">${verificationCode}</span>
        </div>
        <div style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <p style="margin: 0;">GG IT Solutions ERP & LMS Platform. If you did not apply, please ignore this email.</p>
        </div>
      </div>
    `;

    try {
      await this.emailNotificationService.sendEmail(
        savedApp.email,
        'Welcome to GG IT Solutions - Student Account Created',
        emailHtml,
      );
    } catch (emailErr) {
      // Don't block application creation if email sending fails
      console.error('Failed to send verification email:', emailErr);
    }

    const result = await this.applicationRepository.findOne({
      where: { id: savedApp.id },
      relations: { course: true, documents: true },
    });

    if (!result) {
      throw new NotFoundException('Failed to retrieve newly created application.');
    }

    return result;
  }

  /**
   * List all course applications (Admin only)
   */
  async getApplications(): Promise<Application[]> {
    return this.applicationRepository.find({
      relations: { course: true, documents: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Approve or reject an application. 
   * If APPROVED, automatically registers the student user profile and record.
   */
  async updateStatus(id: number, dto: UpdateApplicationStatusDto): Promise<Application> {
    const app = await this.applicationRepository.findOne({ where: { id } });
    if (!app) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    if (app.status !== 'PENDING') {
      throw new BadRequestException(`Application has already been processed with status: ${app.status}`);
    }

    app.status = dto.status;
    const updatedApp = await this.applicationRepository.save(app);

    // Provision User and Student profiles on approval
    if (dto.status === 'APPROVED') {
      // 1. Check if user already exists
      let user = await this.userRepository.findOne({ where: { email: app.email } });
      
      if (!user) {
        // Hash a default password: e.g. GGIT1234
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('GGIT1234', salt);

        // Split fullName into firstName & lastName
        const nameParts = app.fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Applicant';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        user = this.userRepository.create({
          email: app.email,
          passwordHash,
          firstName,
          lastName,
          roleId: 3, // STUDENT role ID
          phone: app.phone,
          isActive: true,
        });
        user = await this.userRepository.save(user);
      }

      // 2. Check if student record exists, if not create it
      let student = await this.studentRepository.findOne({ where: { userId: user.id } });
      if (!student) {
        const registrationNo = `GGIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        student = this.studentRepository.create({
          userId: user.id,
          registrationNo,
          admissionDate: new Date().toISOString().split('T')[0], // yyyy-mm-dd
        });
        student = await this.studentRepository.save(student);
      }

      // 3. Provision Parent/Guardian user & profile if guardianEmail is provided
      if (app.guardianEmail) {
        let parentUser = await this.userRepository.findOne({ where: { email: app.guardianEmail } });
        if (!parentUser) {
          const salt = await bcrypt.genSalt(10);
          const parentPasswordHash = await bcrypt.hash('GGIT1234', salt);

          const guardianParts = app.guardianName ? app.guardianName.trim().split(/\s+/) : ['Guardian'];
          const parentFirstName = guardianParts[0] || 'Guardian';
          const parentLastName = guardianParts.slice(1).join(' ') || 'User';

          parentUser = this.userRepository.create({
            email: app.guardianEmail,
            passwordHash: parentPasswordHash,
            firstName: parentFirstName,
            lastName: parentLastName,
            roleId: 4, // PARENT role ID
            phone: app.guardianPhone,
            isActive: true,
          });
          parentUser = await this.userRepository.save(parentUser);
        }

        let parent = await this.parentRepository.findOne({
          where: { userId: parentUser.id },
          relations: { students: true }
        });
        if (!parent) {
          parent = this.parentRepository.create({
            userId: parentUser.id,
            students: [student]
          });
          await this.parentRepository.save(parent);
        } else {
          // If parent exists, ensure student is linked
          if (!parent.students) {
            parent.students = [];
          }
          if (!parent.students.find(s => s.id === student.id)) {
            parent.students.push(student);
            await this.parentRepository.save(parent);
          }
        }
      }
    }

    return updatedApp;
  }

  /**
   * Search for an existing guardian by email
   */
  async findGuardianByEmail(email: string): Promise<any> {
    const parentUser = await this.userRepository.findOne({
      where: { email, roleId: 4 }, // roleId 4 is PARENT
    });
    if (parentUser) {
      return {
        exists: true,
        fullName: `${parentUser.firstName} ${parentUser.lastName}`.trim(),
        phone: parentUser.phone || '',
      };
    }
    return { exists: false };
  }
}
