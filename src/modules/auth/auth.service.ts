import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from '../cards/entities/card.entity';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { ScanCardDto } from './dto/scan-card.dto';
import { ScanCardResponseDto } from './dto/scan-card-response.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Card) private readonly cardRepo: Repository<Card>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
  ) {}

  async scanCard(dto: ScanCardDto): Promise<ScanCardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code: dto.code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    const student = await this.studentRepo.findOne({
      where: { cardId: card.id },
    });
    if (!student) {
      return { status: card.status, student: false, parents: [false, false] };
    }

    const linkedParents = await this.studentParentRepo.find({
      where: { studentId: student.id },
    });

    return {
      status: card.status,
      student: true,
      parents: [linkedParents.length >= 1, linkedParents.length >= 2],
    };
  }
}
