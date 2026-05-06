import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Vendor } from '../vendors/entities/vendor.entity';
import { UserRole } from '../users/user.types';
import { OrderResponseDto } from '../orders/dto/order-response.dto';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
  ) {}

  afterInit(server: Server): void {
    if (this.configService.get('NODE_ENV') === 'prod') {
      const allowed = this.configService.get<string>('ALLOWED_ORIGINS');
      server.engine.opts.cors = {
        origin: allowed?.split(',') ?? [],
      };
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const raw =
        (client.handshake.auth.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!raw) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; role: UserRole }>(
        raw,
        { secret: this.configService.getOrThrow('ACCESS_TOKEN_SECRET') },
      );

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      await client.join(`user:${payload.sub}`);

      if (payload.role === UserRole.VENDOR) {
        const vendor = await this.vendorRepo.findOne({
          where: { userId: payload.sub },
        });
        if (vendor) {
          await client.join(`vendor:${vendor.id}`);
          client.data.vendorId = vendor.id;
        }
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emitOrderCreated(vendorId: string, order: OrderResponseDto): void {
    this.server.to(`vendor:${vendorId}`).emit('order.created', order);
  }

  emitOrderUpdated(userIds: string[], order: OrderResponseDto): void {
    for (const userId of userIds) {
      this.server.to(`user:${userId}`).emit('order.updated', order);
    }
  }
}
