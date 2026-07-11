import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Post('apply')
  async apply(@Body() createApplicationDto: CreateApplicationDto) {
    return this.admissionsService.apply(createApplicationDto);
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
