import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFcmTokenDto {
  @ApiPropertyOptional({
    description: 'Firebase FCM device token. Send null to clear.',
  })
  @IsString()
  @IsOptional()
  fcmToken?: string | null;
}
