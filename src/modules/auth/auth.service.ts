import {
  BadRequestException,
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
import { Otp } from '../otp/entities/otp.entity';
import { OtpType } from '../otp/otp.types';
import { CardStatus } from '../cards/card.types';
import { UserRole, UserStatus } from '../users/user.types';
import { ScanCardDto } from './dto/scan-card.dto';
import { ScanCardResponseDto } from './dto/scan-card-response.dto';
import { SignupParentDto } from './dto/signup-parent.dto';
import { SignupStudentDto } from './dto/signup-student.dto';
import { SignupVendorDto } from './dto/signup-vendor.dto';
import { SigninDto } from './dto/signin.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { MeResponseDto } from './dto/me-response.dto';
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
    @InjectRepository(Otp) private readonly otpRepo: Repository<Otp>,
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
      return {
        status: card.status,
        student: false,
        requiresStudentInfo: true,
        parents: [false, false],
      };
    }

    const [studentUser, linkedParents] = await Promise.all([
      this.userRepo.findOne({ where: { id: student.userId } }),
      this.studentParentRepo.find({ where: { studentId: student.id } }),
    ]);

    return {
      status: card.status,
      student: true,
      requiresStudentInfo: !studentUser?.phone,
      parents: [linkedParents.length >= 1, linkedParents.length >= 2],
    };
  }

  async signupParent(dto: SignupParentDto): Promise<AuthTokensResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code: dto.cardCode } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (
      card.status !== CardStatus.ACTIVE &&
      card.status !== CardStatus.UNASSIGNED
    ) {
      throw new ConflictException(ErrorMessages.AUTH.CARD_NOT_ACTIVE);
    }

    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existingUser)
      throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);

    if (card.status === CardStatus.UNASSIGNED) {
      if (!dto.studentFirstName || !dto.studentLastName) {
        throw new BadRequestException(
          ErrorMessages.AUTH.STUDENT_FIELDS_REQUIRED,
        );
      }

      return this.dataSource.transaction(async (manager) => {
        const studentUser = await manager.save(User, {
          firstName: dto.studentFirstName,
          lastName: dto.studentLastName,
          role: UserRole.STUDENT,
          schoolId: card.schoolId,
          isOnboarded: false,
        });

        const student = await manager.save(Student, {
          userId: studentUser.id,
          cardId: card.id,
          schoolId: card.schoolId,
          class: dto.studentClass,
        });

        await manager.save(Wallet, { studentId: student.id });

        const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 10) : undefined;
        await manager.update(Card, card.id, {
          status: CardStatus.ACTIVE,
          studentId: student.id,
          ...(pinHash !== undefined ? { pinHash } : {}),
        });

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const parentUser = await manager.save(User, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          passwordHash,
          role: UserRole.PARENT,
          isOnboarded: true,
        });

        const parent = await manager.save(Parent, { userId: parentUser.id });
        await manager.save(StudentParent, {
          studentId: student.id,
          parentId: parent.id,
        });

        const accessToken = this.jwtService.sign({
          sub: parentUser.id,
          role: parentUser.role,
        });

        const rawRefreshToken = randomBytes(64).toString('hex');
        const tokenHash = createHash('sha256')
          .update(rawRefreshToken)
          .digest('hex');

        await manager.save(RefreshToken, {
          userId: parentUser.id,
          tokenHash,
          expiresAt: this.buildRefreshTokenExpiry(),
        });

        return { accessToken, refreshToken: rawRefreshToken };
      });
    }

    // Card ACTIVE — student already exists, just link the parent
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

    // The card's PIN belongs to the student, not to whichever parent
    // registers it. A second parent joining an already-PIN'd card must
    // confirm the PIN already set (by the first parent or the student),
    // not set a different one.
    if (dto.pin && card.pinHash) {
      const pinMatches = await bcrypt.compare(dto.pin, card.pinHash);
      if (!pinMatches) {
        throw new ConflictException(ErrorMessages.CARDS.PIN_MISMATCH);
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      if (dto.pin && !card.pinHash) {
        const pinHash = await bcrypt.hash(dto.pin, 10);
        await manager.update(Card, card.id, { pinHash });
      }

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

    if (
      card.status !== CardStatus.UNASSIGNED &&
      card.status !== CardStatus.ACTIVE
    ) {
      throw new ConflictException(ErrorMessages.AUTH.CARD_NOT_AVAILABLE);
    }

    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existingUser)
      throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);

    // Card ACTIVE — check if the parent registered first and left a shell student
    if (card.status === CardStatus.ACTIVE) {
      const student = await this.studentRepo.findOne({
        where: { cardId: card.id },
        relations: ['user'],
      });

      if (!student || student.user.phone) {
        throw new ConflictException(ErrorMessages.AUTH.CARD_NOT_AVAILABLE);
      }

      // The parent may have already set the card's PIN while creating this
      // shell student. The student must confirm that same PIN here, not
      // set a different one — a PIN change must go through reset-PIN.
      if (dto.pin && card.pinHash) {
        const pinMatches = await bcrypt.compare(dto.pin, card.pinHash);
        if (!pinMatches) {
          throw new ConflictException(ErrorMessages.CARDS.PIN_MISMATCH);
        }
      }

      // Claim the shell student account created by the parent — the parent
      // already set the student's name, so it's kept as-is here rather than
      // overwritten with whatever the student re-enters.
      return this.dataSource.transaction(async (manager) => {
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const pinHash =
          dto.pin && !card.pinHash ? await bcrypt.hash(dto.pin, 10) : undefined;

        await manager.update(User, student.userId, {
          phone: dto.phone,
          passwordHash,
          isOnboarded: true,
        });

        if (dto.class) {
          await manager.update(Student, student.id, { class: dto.class });
        }

        if (pinHash !== undefined) {
          await manager.update(Card, card.id, { pinHash });
        }

        const accessToken = this.jwtService.sign({
          sub: student.userId,
          role: UserRole.STUDENT,
        });

        const rawRefreshToken = randomBytes(64).toString('hex');
        const tokenHash = createHash('sha256')
          .update(rawRefreshToken)
          .digest('hex');

        await manager.save(RefreshToken, {
          userId: student.userId,
          tokenHash,
          expiresAt: this.buildRefreshTokenExpiry(),
        });

        return { accessToken, refreshToken: rawRefreshToken };
      });
    }

    // Card UNASSIGNED — student registers first
    if (!dto.firstName || !dto.lastName) {
      throw new BadRequestException(ErrorMessages.AUTH.STUDENT_FIELDS_REQUIRED);
    }

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

      const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 10) : undefined;
      await manager.update(Card, card.id, {
        status: CardStatus.ACTIVE,
        studentId: student.id,
        ...(pinHash !== undefined ? { pinHash } : {}),
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

  async signout(dto: RefreshTokenDto): Promise<void> {
    const tokenHash = createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, isRevoked: false },
    });

    if (!stored) return;

    await this.refreshTokenRepo.update(stored.id, {
      isRevoked: true,
      revokedAt: new Date(),
    });
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    const tokenHash = createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    }

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });

    await this.refreshTokenRepo.update(stored.id, {
      isRevoked: true,
      revokedAt: new Date(),
    });

    const accessToken = this.jwtService.sign({
      sub: user!.id,
      role: user!.role,
    });

    const rawRefreshToken = randomBytes(64).toString('hex');
    const newTokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    await this.refreshTokenRepo.save({
      userId: user!.id,
      tokenHash: newTokenHash,
      expiresAt: this.buildRefreshTokenExpiry(),
    });

    return { accessToken, refreshToken: rawRefreshToken };
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

    if (user.status !== UserStatus.VALIDATED) {
      throw new UnauthorizedException(ErrorMessages.AUTH.ACCOUNT_BLOCKED);
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ code: string }> {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException(ErrorMessages.USERS.NOT_FOUND);

    await this.otpRepo.update(
      { phone: dto.phone, type: OtpType.PASSWORD_RESET, isUsed: false },
      { isUsed: true },
    );

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.otpRepo.save({
      phone: dto.phone,
      code,
      type: OtpType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return { code };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const otp = await this.otpRepo.findOne({
      where: {
        phone: dto.phone,
        code: dto.code,
        type: OtpType.PASSWORD_RESET,
        isUsed: false,
      },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException(
        ErrorMessages.AUTH.OTP_INVALID_OR_EXPIRED,
      );
    }

    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException(ErrorMessages.USERS.NOT_FOUND);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await Promise.all([
      this.userRepo.update(user.id, { passwordHash }),
      this.otpRepo.update(otp.id, { isUsed: true }),
    ]);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(ErrorMessages.USERS.NOT_FOUND);

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match)
      throw new UnauthorizedException(ErrorMessages.AUTH.WRONG_PASSWORD);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.update(userId, { passwordHash });
  }

  async updateFcmToken(
    userId: string,
    fcmToken: string | null | undefined,
  ): Promise<void> {
    await this.userRepo.update(userId, { fcmToken: fcmToken ?? null });
  }

  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['school'],
    });
    if (!user) throw new NotFoundException(ErrorMessages.USERS.NOT_FOUND);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      schoolId: user.schoolId ?? null,
      schoolName: user.school?.name ?? null,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(ErrorMessages.USERS.NOT_FOUND);

    if (dto.phone !== user.phone) {
      const existingUser = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });
      if (existingUser)
        throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
    }

    await this.userRepo.update(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });

    return this.getMe(userId);
  }

  /// Soft delete: the underlying vendor/parent/student row and its
  /// transaction history (orders, withdrawals, wallet entries) are kept for
  /// accounting — only the login is closed off. TypeORM's default queries
  /// already exclude soft-deleted users, and the phone number's unique
  /// index is scoped to non-deleted rows, so it becomes free to re-signup
  /// with immediately.
  async deleteMe(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(ErrorMessages.USERS.NOT_FOUND);

    await this.refreshTokenRepo.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );
    await this.userRepo.softDelete(userId);
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
