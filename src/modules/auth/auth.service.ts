import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Card } from '../cards/entities/card.entity';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { Parent } from '../parents/entities/parent.entity';
import { RefreshToken } from '../refresh-tokens/entities/refresh-token.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { School } from '../schools/entities/school.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { VendorWallet } from '../vendors/entities/vendor-wallet.entity';
import { CardStatus } from '../cards/card.types';
import { UserRole } from '../users/user.types';
import { ScanCardDto } from './dto/scan-card.dto';
import { ScanCardResponseDto } from './dto/scan-card-response.dto';
import { SignupParentDto } from './dto/signup-parent.dto';
import { SignupStudentDto } from './dto/signup-student.dto';
import { SignupVendorDto } from './dto/signup-vendor.dto';
import { SigninDto } from './dto/signin.dto';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Card) private readonly cardRepo: Repository<Card>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

  async signupParent(dto: SignupParentDto): Promise<AuthTokensResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code: dto.cardCode } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (card.status !== CardStatus.ACTIVE) {
      throw new ConflictException(ErrorMessages.AUTH.CARD_NOT_ACTIVE);
    }

    const student = await this.studentRepo.findOne({
      where: { cardId: card.id },
    });
    if (!student)
      throw new ConflictException(ErrorMessages.AUTH.CARD_HAS_NO_STUDENT);

    const parentCount = await this.studentParentRepo.count({
      where: { studentId: student.id },
    });
    if (parentCount >= 2) {
      throw new ConflictException(
        ErrorMessages.AUTH.STUDENT_ALREADY_HAS_TWO_PARENTS,
      );
    }

    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existingUser)
      throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = await manager.save(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        role: UserRole.PARENT,
        isOnboarded: true,
      });

      const parent = await manager.save(Parent, { userId: user.id });

      await manager.save(StudentParent, {
        studentId: student.id,
        parentId: parent.id,
      });

      const accessToken = this.jwtService.sign({
        sub: user.id,
        role: user.role,
      });

      const rawRefreshToken = randomBytes(64).toString('hex');
      const tokenHash = createHash('sha256')
        .update(rawRefreshToken)
        .digest('hex');

      await manager.save(RefreshToken, {
        userId: user.id,
        tokenHash,
        expiresAt: this.buildRefreshTokenExpiry(),
      });

      return { accessToken, refreshToken: rawRefreshToken };
    });
  }

  async signupStudent(dto: SignupStudentDto): Promise<AuthTokensResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code: dto.cardCode } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (card.status !== CardStatus.UNASSIGNED) {
      throw new ConflictException(ErrorMessages.AUTH.CARD_NOT_AVAILABLE);
    }

    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existingUser)
      throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = await manager.save(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        role: UserRole.STUDENT,
        schoolId: card.schoolId,
        isOnboarded: true,
      });

      const student = await manager.save(Student, {
        userId: user.id,
        cardId: card.id,
        schoolId: card.schoolId,
        class: dto.class,
      });

      await manager.save(Wallet, { studentId: student.id });

      await manager.update(Card, card.id, {
        status: CardStatus.ACTIVE,
        studentId: student.id,
      });

      const accessToken = this.jwtService.sign({
        sub: user.id,
        role: user.role,
      });

      const rawRefreshToken = randomBytes(64).toString('hex');
      const tokenHash = createHash('sha256')
        .update(rawRefreshToken)
        .digest('hex');

      await manager.save(RefreshToken, {
        userId: user.id,
        tokenHash,
        expiresAt: this.buildRefreshTokenExpiry(),
      });

      return { accessToken, refreshToken: rawRefreshToken };
    });
  }

  async signupVendor(dto: SignupVendorDto): Promise<AuthTokensResponseDto> {
    const school = await this.schoolRepo.findOne({
      where: { id: dto.schoolId },
    });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existingUser)
      throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = await manager.save(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        role: UserRole.VENDOR,
        schoolId: dto.schoolId,
        isOnboarded: true,
      });

      const vendor = await manager.save(Vendor, {
        userId: user.id,
        schoolId: dto.schoolId,
        shopName: dto.shopName,
        waveNumber: dto.waveNumber,
      });

      await manager.save(VendorWallet, { vendorId: vendor.id });

      const accessToken = this.jwtService.sign({
        sub: user.id,
        role: user.role,
      });

      const rawRefreshToken = randomBytes(64).toString('hex');
      const tokenHash = createHash('sha256')
        .update(rawRefreshToken)
        .digest('hex');

      await manager.save(RefreshToken, {
        userId: user.id,
        tokenHash,
        expiresAt: this.buildRefreshTokenExpiry(),
      });

      return { accessToken, refreshToken: rawRefreshToken };
    });
  }

  async signin(dto: SigninDto): Promise<AuthTokensResponseDto> {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) {
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    const rawRefreshToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    await this.refreshTokenRepo.save({
      userId: user.id,
      tokenHash,
      expiresAt: this.buildRefreshTokenExpiry(),
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private buildRefreshTokenExpiry(): Date {
    const raw = this.configService.get<string>('REFRESH_TOKEN_EXPIRY') ?? '7d';
    const match = raw.match(/^(\d+)([dhms])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = {
      d: 86_400_000,
      h: 3_600_000,
      m: 60_000,
      s: 1_000,
    };
    return new Date(Date.now() + value * (multipliers[match[2]] ?? 86_400_000));
  }
}
