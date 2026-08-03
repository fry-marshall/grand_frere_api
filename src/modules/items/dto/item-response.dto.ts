import { ApiProperty } from '@nestjs/swagger';
import { ItemStatus } from '../item.types';

export class ItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vendorId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty({ nullable: true })
  description: string;

  @ApiProperty({ nullable: true })
  imageUrl: string;

  @ApiProperty({
    nullable: true,
    description: 'Image awaiting admin approval, if any',
  })
  pendingImageUrl: string | null;

  @ApiProperty({ enum: ItemStatus })
  status: ItemStatus;

  @ApiProperty()
  createdAt: Date;
}
