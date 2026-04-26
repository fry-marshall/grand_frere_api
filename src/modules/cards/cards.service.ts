import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Card } from './entities/card.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { CardStatus } from './card.types';
import { UserRole } from '../users/user.types';
import { CreateCardsBatchDto } from './dto/create-cards-batch.dto';
import { CardResponseDto } from './dto/card-response.dto';
import * as storageInterface from '../../common/storage/storage.interface';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectRepository(Card) private readonly cardRepo: Repository<Card>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(storageInterface.STORAGE_SERVICE)
    private readonly storageService: storageInterface.IStorageService,
  ) {}

  async createBatch(dto: CreateCardsBatchDto): Promise<CardResponseDto[]> {
    const school = await this.schoolRepo.findOne({
      where: { id: dto.schoolId },
    });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    const codes = await this.generateUniqueCodes(school.sigle, dto.count);

    const qrBuffers = await Promise.all(
      codes.map((code) =>
        QRCode.toBuffer(code, { type: 'png', width: 400, margin: 2 }),
      ),
    );

    const uploadedKeys: string[] = [];
    const imageUrls: string[] = [];
    const batchSize = 3;

    try {
      for (let i = 0; i < codes.length; i += batchSize) {
        const slice = codes.slice(i, i + batchSize);
        const bufferSlice = qrBuffers.slice(i, i + batchSize);
        const results = await Promise.all(
          slice.map((code, j) => {
            const key = `cards/${dto.schoolId}/${code}.png`;
            uploadedKeys.push(key);
            return this.storageService.uploadBuffer(
              bufferSlice[j],
              key,
              'image/png',
            );
          }),
        );
        imageUrls.push(...results);
      }
    } catch (error) {
      this.logger.error('QR upload failed, rolling back Spaces keys');
      await Promise.allSettled(
        uploadedKeys.map((key) => this.storageService.deleteFile(key)),
      );
      throw error;
    }

    let savedCards: Card[];
    try {
      savedCards = await this.cardRepo.save(
        codes.map((code, i) => ({
          code,
          schoolId: dto.schoolId,
          status: CardStatus.UNASSIGNED,
          imageUrl: imageUrls[i],
        })),
      );
    } catch (error) {
      this.logger.error('DB write failed, rolling back Spaces keys');
      await Promise.allSettled(
        uploadedKeys.map((key) => this.storageService.deleteFile(key)),
      );
      throw error;
    }

    return savedCards.map((card) => this.toDto(card));
  }

  private async generateUniqueCodes(
    sigle: string,
    count: number,
  ): Promise<string[]> {
    const codes = new Set<string>();

    while (codes.size < count) {
      const digits = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      const code = `GF-${sigle}-${digits}`;

      if (codes.has(code)) continue;

      const exists = await this.cardRepo.existsBy({ code });
      if (!exists) codes.add(code);
    }

    return Array.from(codes);
  }

  async findOne(
    code: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== card.schoolId) {
        throw new ForbiddenException();
      }
    }

    return this.toDto(card);
  }

  private toDto(card: Card): CardResponseDto {
    return {
      id: card.id,
      code: card.code,
      status: card.status,
      schoolId: card.schoolId,
      studentId: card.studentId ?? null,
      dailyLimit: card.dailyLimit,
      imageUrl: card.imageUrl ?? null,
      createdAt: card.createdAt,
    };
  }
}
