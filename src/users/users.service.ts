import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationService } from '../common/services/notification.service';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    private jwtService: JwtService,
    private notificationService: NotificationService,
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
    return this.usersRepository.find({ relations: { role: true } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
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
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async login(email: string, pass: string): Promise<{ accessToken: string; user: any }> {
    // Explicitly select passwordHash since it's hidden by default
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !user.passwordHash || !(await bcrypt.compare(pass, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is currently deactivated');
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
}
