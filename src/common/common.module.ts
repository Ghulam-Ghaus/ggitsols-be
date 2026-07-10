import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './services/notification.service';
import { ActivityLog } from './entities/activity-log.entity';
import { Notification } from './entities/notification.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog, Notification])],
  providers: [NotificationService],
  exports: [NotificationService, TypeOrmModule],
})
export class CommonModule {}
