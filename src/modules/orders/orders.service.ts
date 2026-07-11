import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { OrderStatus, PaymentMethod } from './order.types';
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
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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
    private readonly gateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService,
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
      relations: ['items', 'items.item', 'vendor', 'student', 'student.user'],
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
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      shortCode: order.shortCode ?? null,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      vendor: order.vendor
        ? {
            id: order.vendor.id,
            shopName: order.vendor.shopName,
            waveNumber: order.vendor.waveNumber,
          }
        : undefined,
      student: order.student?.user
        ? {
            user: {
              firstName: order.student.user.firstName,
              lastName: order.student.user.lastName,
            },
          }
        : undefined,
      items: order.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        item: i.item ? { name: i.item.name } : undefined,
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

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.WALLET;

    const itemPriceMap = new Map(items.map((i) => [i.id, i.price]));
    const totalAmount = dto.items.reduce(
      (sum, line) => sum + itemPriceMap.get(line.itemId)! * line.quantity,
      0,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const defaultDate = new Date(today);
    if (defaultDate.getUTCDay() === 6)
      defaultDate.setUTCDate(defaultDate.getUTCDate() + 2);
    else if (defaultDate.getUTCDay() === 0)
      defaultDate.setUTCDate(defaultDate.getUTCDate() + 1);
    const defaultDateStr = defaultDate.toISOString().slice(0, 10);

    const scheduledFor = dto.scheduledFor ?? defaultDateStr;
    const scheduledDate = new Date(scheduledFor);
    const dayOfWeek = scheduledDate.getUTCDay();
    if (scheduledDate < today || dayOfWeek === 0 || dayOfWeek === 6) {
      throw new BadRequestException(
        ErrorMessages.ORDERS.INVALID_SCHEDULED_DATE,
      );
    }

    if (paymentMethod === PaymentMethod.WALLET) {
      const available = wallet.balance - wallet.reserved;
      if (available < totalAmount) {
        throw new BadRequestException(
          ErrorMessages.ORDERS.INSUFFICIENT_BALANCE,
        );
      }

      const card = await this.cardRepo.findOne({
        where: { studentId: student.id },
      });
      if (card) {
        if (
          card.status === CardStatus.SUSPENDED ||
          card.status === CardStatus.BLOCKED
        ) {
          throw new BadRequestException(ErrorMessages.CARDS.NOT_ACTIVE);
        }

        const row = await this.orderRepo
          .createQueryBuilder('o')
          .select('COALESCE(SUM(o.totalAmount), 0)', 'total')
          .where('o.studentId = :studentId', { studentId: dto.studentId })
          .andWhere('o.status IN (:...statuses)', {
            statuses: [OrderStatus.PENDING, OrderStatus.VALIDATED],
          })
          .andWhere('o.scheduledFor = :scheduledFor', { scheduledFor })
          .getRawOne<{ total: string }>();

        const spentOnDay = parseInt(row?.total ?? '0', 10);
        if (spentOnDay + totalAmount > card.dailyLimit) {
          throw new BadRequestException(
            ErrorMessages.ORDERS.DAILY_LIMIT_EXCEEDED,
          );
        }
      }
    }

    const expiresAt = new Date(scheduledFor);
    expiresAt.setHours(23, 59, 59, 999);

    const shortCode = await this.generateShortCode(vendorId, scheduledFor);

    const order = await this.dataSource.transaction(async (manager) => {
      const newOrder = await manager.save(Order, {
        vendorId,
        studentId: dto.studentId,
        status: OrderStatus.PENDING,
        paymentMethod,
        totalAmount,
        shortCode,
        expiresAt,
        scheduledFor,
      });

      for (const line of dto.items) {
        await manager.save(OrderItem, {
          orderId: newOrder.id,
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: itemPriceMap.get(line.itemId)!,
        });
      }

      if (paymentMethod === PaymentMethod.WALLET) {
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
      }

      return newOrder;
    });

    this.gateway.emitOrderCreated(vendorId, this.toDto(order));

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

    const updated = await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, order.id, { status: OrderStatus.VALIDATED });

      if (order.paymentMethod === PaymentMethod.WALLET) {
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
      }

      return { ...order, status: OrderStatus.VALIDATED };
    });

    const dto = this.toDto(updated);
    this.emitOrderUpdatedToAffectedUsers(updated.studentId, dto).catch((err) =>
      this.logger.error(`WS emit failed for order ${updated.id}`, err.stack),
    );

    return dto;
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

      if (order.paymentMethod === PaymentMethod.WALLET) {
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
      }
    });

    const dto = this.toDto({ ...order, status: OrderStatus.CANCELLED });
    this.emitOrderUpdatedToAffectedUsers(order.studentId, dto).catch((err) =>
      this.logger.error(`WS emit failed for order ${order.id}`, err.stack),
    );

    return dto;
  }

  async complete(
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

    if (order.status !== OrderStatus.VALIDATED) {
      throw new BadRequestException(ErrorMessages.ORDERS.NOT_VALIDATED);
    }

    let vendorWallet = await this.vendorWalletRepo.findOne({
      where: { vendorId: order.vendorId },
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, order.id, { status: OrderStatus.COMPLETED });

      if (order.paymentMethod === PaymentMethod.WALLET) {
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
      }
    });

    const dto = this.toDto({ ...order, status: OrderStatus.COMPLETED });
    this.emitOrderUpdatedToAffectedUsers(order.studentId, dto).catch((err) =>
      this.logger.error(`WS emit failed for order ${order.id}`, err.stack),
    );

    return dto;
  }

  private async emitOrderUpdatedToAffectedUsers(
    studentId: string,
    order: OrderResponseDto,
  ): Promise<void> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student?.userId) return;

    const userIds = [student.userId];

    const links = await this.studentParentRepo.find({ where: { studentId } });
    for (const link of links) {
      const parent = await this.parentRepo.findOne({
        where: { id: link.parentId },
      });
      if (parent?.userId) userIds.push(parent.userId);
    }

    this.gateway.emitOrderUpdated(userIds, order);

    let notificationType: NotificationType;
    let title: string;
    let body: string;

    if (order.status === OrderStatus.VALIDATED) {
      notificationType = NotificationType.ORDER_VALIDATED;
      title = 'Commande validée';
      body = `Votre commande de ${order.totalAmount} FCFA a été validée.`;
    } else if (order.status === OrderStatus.COMPLETED) {
      notificationType = NotificationType.ORDER_COMPLETED;
      title = 'Commande encaissée';
      body = `Votre commande de ${order.totalAmount} FCFA a été encaissée.`;
    } else {
      notificationType = NotificationType.ORDER_CANCELLED;
      title = 'Commande annulée';
      body = `Votre commande de ${order.totalAmount} FCFA a été annulée.`;
    }

    for (const userId of userIds) {
      await this.notificationsService.createNotification(
        notificationType,
        userId,
        { title, body },
      );
    }
  }

  private toDto(order: Order): OrderResponseDto {
    return {
      id: order.id,
      studentId: order.studentId,
      vendorId: order.vendorId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      shortCode: order.shortCode ?? null,
      expiresAt: order.expiresAt,
      scheduledFor: order.scheduledFor,
      createdAt: order.createdAt,
    };
  }

  async findByCard(
    cardCode: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<OrderDetailResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { userId: currentUser.id },
    });
    if (!vendor) throw new ForbiddenException();

    const card = await this.cardRepo.findOne({ where: { code: cardCode } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    const student = await this.studentRepo.findOne({
      where: { cardId: card.id },
    });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    const order = await this.orderRepo.findOne({
      where: {
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.VALIDATED,
      },
      relations: ['items', 'items.item', 'vendor', 'student', 'student.user'],
      order: { createdAt: 'DESC' },
    });
    if (!order) throw new NotFoundException(ErrorMessages.ORDERS.NOT_FOUND);

    return {
      id: order.id,
      studentId: order.studentId,
      vendorId: order.vendorId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      shortCode: order.shortCode ?? null,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      vendor: order.vendor
        ? {
            id: order.vendor.id,
            shopName: order.vendor.shopName,
            waveNumber: order.vendor.waveNumber,
          }
        : undefined,
      student: order.student?.user
        ? {
            user: {
              firstName: order.student.user.firstName,
              lastName: order.student.user.lastName,
            },
          }
        : undefined,
      items: order.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        item: i.item ? { name: i.item.name } : undefined,
      })),
    };
  }

  async findByCode(
    code: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<OrderDetailResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { userId: currentUser.id },
    });
    if (!vendor) throw new ForbiddenException();

    const order = await this.orderRepo.findOne({
      where: {
        shortCode: code,
        vendorId: vendor.id,
        status: OrderStatus.VALIDATED,
      },
      relations: ['items', 'items.item', 'vendor', 'student', 'student.user'],
    });
    if (!order) throw new NotFoundException(ErrorMessages.ORDERS.NOT_FOUND);

    return {
      id: order.id,
      studentId: order.studentId,
      vendorId: order.vendorId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      shortCode: order.shortCode ?? null,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      vendor: order.vendor
        ? {
            id: order.vendor.id,
            shopName: order.vendor.shopName,
            waveNumber: order.vendor.waveNumber,
          }
        : undefined,
      student: order.student?.user
        ? {
            user: {
              firstName: order.student.user.firstName,
              lastName: order.student.user.lastName,
            },
          }
        : undefined,
      items: order.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        item: i.item ? { name: i.item.name } : undefined,
      })),
    };
  }

  private async generateShortCode(
    vendorId: string,
    scheduledFor: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const existing = await this.orderRepo.findOne({
        where: { vendorId, scheduledFor, shortCode: code },
      });
      if (!existing) return code;
    }
    return String(Date.now() % 10000).padStart(4, '0');
  }
}
