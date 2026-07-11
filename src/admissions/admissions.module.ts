import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { ApplicationDocument } from './entities/application-document.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../academic/entities/student.entity';
import { Parent } from '../academic/entities/parent.entity';
import { AdmissionsService } from './admissions.service';
import { AdmissionsController } from './admissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, ApplicationDocument, User, Student, Parent]),
  ],
  providers: [AdmissionsService],
  controllers: [AdmissionsController],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
