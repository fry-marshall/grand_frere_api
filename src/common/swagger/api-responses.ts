import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponse {
  @ApiProperty({
    example: 'Error message',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: 400 })
  statusCode: number;
}
