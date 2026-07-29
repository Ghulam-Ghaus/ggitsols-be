import { Controller, Get, Post, Patch, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdmissionsService } from './admissions.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import * as path from 'path';
import * as fs from 'fs/promises';

@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Post('apply')
  async apply(@Body() createApplicationDto: CreateApplicationDto) {
    return this.admissionsService.apply(createApplicationDto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    // file size validation (max 500kb)
    if (file.size > 500 * 1024) {
      throw new BadRequestException('File size exceeds 500KB limit');
    }
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    const uploadPath = path.join(__dirname, '..', '..', 'uploads');
    
    // Ensure directory exists
    await fs.mkdir(uploadPath, { recursive: true });
    
    // Write file
    await fs.writeFile(path.join(uploadPath, filename), file.buffer);
    
    return {
      fileUrl: `http://localhost:9000/uploads/${filename}`,
      filename: file.originalname
    };
  }

  @Get('guardian/:email')
  async findGuardianByEmail(@Param('email') email: string) {
    return this.admissionsService.findGuardianByEmail(email);
  }

  @Get('applications')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getApplications() {
    return this.admissionsService.getApplications();
  }

  @Patch('applications/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateApplicationStatusDto,
  ) {
    return this.admissionsService.updateStatus(Number(id), updateStatusDto);
  }
}

