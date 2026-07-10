import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
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
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  async seedRoles() {
    const rolesToSeed = [
      { id: 1, name: 'ADMIN', description: 'System Administrator with full access' },
      { id: 2, name: 'TEACHER', description: 'Academic staff members' },
      { id: 3, name: 'STUDENT', description: 'Enrolled students' },
      { id: 4, name: 'PARENT', description: 'Parents or guardians of students' },
      { id: 5, name: 'APPLICANT', description: 'Prospective students applying for admission' },
      { id: 6, name: 'PUBLIC', description: 'Guest/non-registered visitors' },
    ];

    for (const r of rolesToSeed) {
      const exists = await this.rolesRepository.findOne({ where: { id: r.id } });
      if (!exists) {
        await this.rolesRepository.save(this.rolesRepository.create(r));
        console.log(`[Seed] Created role: ${r.name}`);
      }
    }
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

    const payload = { id: user.id, email: user.email, role: user.role.name };
    const accessToken = await this.jwtService.signAsync(payload);

    const userResponse = { ...user };
    delete userResponse.passwordHash;

    return {
      accessToken,
      user: userResponse,
    };
  }
}
