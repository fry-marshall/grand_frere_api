import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../wallets/entities/transaction.entity';
import { Student } from '../students/entities/student.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Item } from '../items/entities/item.entity';
import { Card } from '../cards/entities/card.entity';
import { VendorWallet } from '../vendors/entities/vendor-wallet.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { OrderStatus } from './order.types';
import { ItemStatus } from '../items/item.types';
import { CardStatus } from '../cards/card.types';
import { TransactionType } from '../wallets/wallet.types';
import { UserRole } from '../users/user.types';
import { Currency } from '../../common/enums/currency.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderDetailResponseDto } from './dto/order-detail-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Card)
    private readonly cardRepo: Repository<Card>,
    @InjectRepository(VendorWallet)
    private readonly vendorWalletRepo: Repository<VendorWallet>,
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: OrderResponseDto[]; meta: object }> {
    const { page, limit } = query;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      qb.innerJoin('o.student', 's').where('s.schoolId = :schoolId', {
        schoolId: admin.schoolId,
      });
    } else if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!vendor) throw new ForbiddenException();
      qb.where('o.vendorId = :vendorId', { vendorId: vendor.id });
    } else if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const links = await this.studentParentRepo.find({
        where: { parentId: parent.id },
      });
      const studentIds = links.map((l) => l.studentId);
      if (studentIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      qb.where('o.studentId IN (:...studentIds)', { studentIds });
    } else if (currentUser.role === UserRole.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!student) throw new ForbiddenException();
      qb.where('o.studentId = :studentId', { studentId: student.id });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      data: orders.map((o) => this.toDto(o)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<OrderDetailResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(ErrorMessages.ORDERS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      const student = await this.studentRepo.findOne({
        where: { id: order.studentId },
      });
      if (student?.schoolId !== admin.schoolId) throw new ForbiddenException();
    } else if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!vendor || order.vendorId !== vendor.id)
        throw new ForbiddenException();
    } else if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const link = await this.studentParentRepo.findOne({
        where: { studentId: order.studentId, parentId: parent.id },
      });
      if (!link) throw new ForbiddenException();
    } else if (currentUser.role === UserRole.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!student || order.studentId !== student.id)
        throw new ForbiddenException();
    }

    return {
      id: order.id,
      studentId: order.studentId,
      vendorId: order.vendorId,
      status: order.status,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    };
  }

  async create(
    vendorId: string,
    dto: CreateOrderDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<OrderResponseDto> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const link = await this.studentParentRepo.findOne({
        where: { studentId: dto.studentId, parentId: parent.id },
      });
      if (!link) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.STUDENT) {
      const ownStudent = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (ownStudent?.id !== dto.studentId) throw new ForbiddenException();
    }

    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    const wallet = await this.walletRepo.findOne({
      where: { studentId: dto.studentId },
    });
    if (!wallet) throw new NotFoundException(ErrorMessages.WALLETS.NOT_FOUND);

    const itemIds = dto.items.map((line) => line.itemId);
    const items = await this.itemRepo.find({
      where: { id: In(itemIds), vendorId, status: ItemStatus.ACTIVE },
    });
    if (items.length !== dto.items.length) {
      throw new BadRequestException(ErrorMessages.ORDERS.INVALID_ITEMS);
    }

    const itemPriceMap = new Map(items.map((i) => [i.id, i.price]));
    const totalAmount = dto.items.reduce(
      (sum, line) => sum + itemPriceMap.get(line.itemId)! * line.quantity,
      0,
    );

    const available = wallet.balance - wallet.reserved;
    if (available < totalAmount) {
      throw new BadRequestException(ErrorMessages.ORDERS.INSUFFICIENT_BALANCE);
    }

    const card = await this.cardRepo.findOne({
      where: { studentId: student.id, status: CardStatus.ACTIVE },
    });
    if (card) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const row = await this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.totalAmount), 0)', 'total')
        .where('o.studentId = :studentId', { studentId: dto.studentId })
        .andWhere('o.status IN (:...statuses)', {
          statuses: [OrderStatus.PENDING, OrderStatus.VALIDATED],
        })
        .andWhere('o.createdAt >= :todayStart', { todayStart })
        .getRawOne<{ total: string }>();

      const spentToday = parseInt(row?.total ?? '0', 10);
      if (spentToday + totalAmount > card.dailyLimit) {
        throw new BadRequestException(
          ErrorMessages.ORDERS.DAILY_LIMIT_EXCEEDED,
        );
      }
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const order = await this.dataSource.transaction(async (manager) => {
      const newOrder = await manager.save(Order, {
        vendorId,
        studentId: dto.studentId,
        status: OrderStatus.PENDING,
        totalAmount,
        expiresAt,
      });

      for (const line of dto.items) {
        await manager.save(OrderItem, {
          orderId: newOrder.id,
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: itemPriceMap.get(line.itemId)!,
        });
      }

      await manager.update(Wallet, wallet.id, {
        reserved: wallet.reserved + totalAmount,
      });

      await manager.save(Transaction, {
        walletId: wallet.id,
        type: TransactionType.RESERVE,
        amount: totalAmount,
        currency: wallet.currency ?? Currency.XOF,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        orderId: newOrder.id,
      });

      return newOrder;
    });

    return this.toDto(order);
  }

  async validate(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(ErrorMessages.ORDERS.NOT_FOUND);

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!vendor || order.vendorId !== vendor.id)
        throw new ForbiddenException();
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(ErrorMessages.ORDERS.NOT_PENDING);
    }

    const wallet = await this.walletRepo.findOne({
      where: { studentId: order.studentId },
    });
    if (!wallet) throw new NotFoundException(ErrorMessages.WALLETS.NOT_FOUND);

    let vendorWallet = await this.vendorWalletRepo.findOne({
      where: { vendorId: order.vendorId },
    });

    const updated = await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, order.id, { status: OrderStatus.VALIDATED });

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - order.totalAmount;
      await manager.update(Wallet, wallet.id, {
        balance: balanceAfter,
        reserved: wallet.reserved - order.totalAmount,
      });

      await manager.save(Transaction, {
        walletId: wallet.id,
        type: TransactionType.DEBIT,
        amount: order.totalAmount,
        currency: wallet.currency ?? Currency.XOF,
        balanceBefore,
        balanceAfter,
        orderId: order.id,
      });

      if (vendorWallet) {
        await manager.update(VendorWallet, vendorWallet.id, {
          balance: vendorWallet.balance + order.totalAmount,
        });
      } else {
        vendorWallet = await manager.save(VendorWallet, {
          vendorId: order.vendorId,
          balance: order.totalAmount,
        });
      }

      return { ...order, status: OrderStatus.VALIDATED };
    });

    return this.toDto(updated);
  }

  async cancel(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(ErrorMessages.ORDERS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      const student = await this.studentRepo.findOne({
        where: { id: order.studentId },
      });
      if (student?.schoolId !== admin.schoolId) throw new ForbiddenException();
    } else if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!vendor || order.vendorId !== vendor.id)
        throw new ForbiddenException();
    } else if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const link = await this.studentParentRepo.findOne({
        where: { studentId: order.studentId, parentId: parent.id },
      });
      if (!link) throw new ForbiddenException();
    } else if (currentUser.role === UserRole.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!student || order.studentId !== student.id)
        throw new ForbiddenException();
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(ErrorMessages.ORDERS.NOT_PENDING);
    }

    const wallet = await this.walletRepo.findOne({
      where: { studentId: order.studentId },
    });
    if (!wallet) throw new NotFoundException(ErrorMessages.WALLETS.NOT_FOUND);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, order.id, { status: OrderStatus.CANCELLED });

      await manager.update(Wallet, wallet.id, {
        reserved: wallet.reserved - order.totalAmount,
      });

      await manager.save(Transaction, {
        walletId: wallet.id,
        type: TransactionType.RELEASE,
        amount: order.totalAmount,
        currency: wallet.currency ?? Currency.XOF,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        orderId: order.id,
      });
    });

    return this.toDto({ ...order, status: OrderStatus.CANCELLED });
  }

  private toDto(order: Order): OrderResponseDto {
    return {
      id: order.id,
      studentId: order.studentId,
      vendorId: order.vendorId,
      status: order.status,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
    };
  }
}
