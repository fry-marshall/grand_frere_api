import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationFirebase implements OnModuleInit {
  private readonly logger = new Logger(NotificationFirebase.name);
  private firebaseApp: admin.app.App;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  onModuleInit() {
    if (this.configService.get('NODE_ENV') !== 'prod') return;

    if (admin.apps.length > 0) {
      this.firebaseApp = admin.apps[0]!;
      return;
    }
    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: this.configService.getOrThrow('FIREBASE_PROJECT_ID'),
        privateKey: this.configService
          .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
        clientEmail: this.configService.getOrThrow('FIREBASE_CLIENT_EMAIL'),
      }),
    });
  }

  async send(userId: string, title: string, body: string): Promise<void> {
    if (!this.firebaseApp) return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmToken) return;

    try {
      await this.firebaseApp.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await this.userRepo.update(userId, { fcmToken: null });
        this.logger.warn(`Cleared invalid FCM token for user ${userId}`);
      } else {
        throw err;
      }
    }
  }
}
