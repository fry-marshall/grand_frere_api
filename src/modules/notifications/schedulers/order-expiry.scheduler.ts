import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { Transaction } from '../../wallets/entities/transaction.entity';
import { Student } from '../../students/entities/student.entity';
import { StudentParent } from '../../students/entities/student-parent.entity';
import { OrderStatus } from '../../orders/order.types';
import { TransactionType } from '../../wallets/wallet.types';
import { Currency } from '../../../common/enums/currency.enum';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../notification.types';

@Injectable()
export class OrderExpiryScheduler {
  private readonly logger = new Logger(OrderExpiryScheduler.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('59 23 * * *')
  async expireOrders(): Promise<void> {
    const expiredOrders = await this.orderRepo.find({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: LessThanOrEqual(new Date()),
      },
    });

    this.logger.log(`Expiring ${expiredOrders.length} orders`);

    for (const order of expiredOrders) {
      try {
        await this.dataSource.transaction(async (manager) => {
          await manager.update(Order, order.id, {
            status: OrderStatus.EXPIRED,
          });

          const wallet = await this.walletRepo.findOne({
            where: { studentId: order.studentId },
          });
          if (wallet) {
            const newReserved = Math.max(
              0,
              wallet.reserved - order.totalAmount,
            );
            await manager.update(Wallet, wallet.id, { reserved: newReserved });
            await manager.save(Transaction, {
              walletId: wallet.id,
              type: TransactionType.RELEASE,
              amount: order.totalAmount,
              currency: wallet.currency ?? Currency.XOF,
              balanceBefore: wallet.balance - wallet.reserved,
              balanceAfter: wallet.balance - newReserved,
              orderId: order.id,
            });
          }
        });

        this.sendExpiryNotifications(order).catch((err) =>
          this.logger.error(
            `Expiry notifications failed for order ${order.id}`,
            err.stack,
          ),
        );
      } catch (err) {
        this.logger.error(
          `Failed to expire order ${order.id}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async sendExpiryNotifications(order: Order): Promise<void> {
    const student = await this.studentRepo.findOne({
      where: { id: order.studentId },
    });
    if (!student) return;

    const data = {
      title: 'Commande expirée',
      body: `Votre commande de ${order.totalAmount} FCFA n'a pas été récupérée.`,
    };

    await this.notificationsService.createNotification(
      NotificationType.ORDER_EXPIRED,
      student.userId,
      data,
    );

    const studentParents = await this.studentParentRepo.find({
      where: { studentId: order.studentId },
      relations: ['parent'],
    });
    for (const sp of studentParents) {
      await this.notificationsService.createNotification(
        NotificationType.ORDER_EXPIRED,
        sp.parent.userId,
        data,
      );
    }
  }
}
