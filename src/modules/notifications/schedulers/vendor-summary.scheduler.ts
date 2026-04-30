import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { OrderStatus } from '../../orders/order.types';
import { VendorStatus } from '../../vendors/vendor.types';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../notification.types';

@Injectable()
export class VendorSummaryScheduler {
  private readonly logger = new Logger(VendorSummaryScheduler.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('0 20 * * *')
  async sendVendorSummaries(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      0,
      0,
      0,
    );
    const end = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      23,
      59,
      59,
    );

    const vendors = await this.vendorRepo.find({
      where: { status: VendorStatus.ACTIVE },
    });

    for (const vendor of vendors) {
      try {
        const orderCount = await this.orderRepo
          .createQueryBuilder('order')
          .where('order.vendorId = :vendorId', { vendorId: vendor.id })
          .andWhere('order.status = :status', { status: OrderStatus.PENDING })
          .andWhere('order.expiresAt >= :start', { start })
          .andWhere('order.expiresAt <= :end', { end })
          .getCount();

        if (orderCount === 0) continue;

        const itemSummary = await this.orderItemRepo
          .createQueryBuilder('oi')
          .innerJoin('oi.order', 'order')
          .innerJoin('oi.item', 'item')
          .select('item.name', 'itemName')
          .addSelect('SUM(oi.quantity)', 'total')
          .where('order.vendorId = :vendorId', { vendorId: vendor.id })
          .andWhere('order.status = :status', { status: OrderStatus.PENDING })
          .andWhere('order.expiresAt >= :start', { start })
          .andWhere('order.expiresAt <= :end', { end })
          .groupBy('item.name')
          .getRawMany<{ itemName: string; total: string }>();

        const lines = itemSummary
          .map((r) => `${r.itemName} × ${r.total}`)
          .join(', ');
        const body = `${orderCount} commande(s) demain : ${lines}`;

        await this.notificationsService.createNotification(
          NotificationType.VENDOR_SUMMARY,
          vendor.userId,
          { title: 'Résumé des commandes du lendemain', body },
        );
      } catch (err) {
        this.logger.error(
          `Failed to send summary for vendor ${vendor.id}`,
          err.stack,
        );
      }
    }
  }
}
