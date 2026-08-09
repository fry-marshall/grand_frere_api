import { ApiProperty } from '@nestjs/swagger';

export class UploadBatchPdfResponseDto {
  @ApiProperty()
  pdfUrl: string;
}
